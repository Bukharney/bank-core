package middleware

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	logger "github.com/bukharney/bank-core/internal/logs"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
)

type contextKey string

const (
	UserIDContextKey contextKey = "userId"
)

// responseRecorder captures the HTTP status code, headers, and body for idempotency caching
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func newResponseRecorder(w http.ResponseWriter) *responseRecorder {
	return &responseRecorder{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
		body:           &bytes.Buffer{},
	}
}

func (r *responseRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

// IdempotencyMiddleware creates a middleware that enforces idempotency on mutating HTTP requests
func IdempotencyMiddleware(repo models.IdempotencyRepository, cfg *config.Config, lockDuration time.Duration) func(http.Handler) http.Handler {
	if lockDuration <= 0 {
		lockDuration = 30 * time.Second
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only apply to state-modifying requests (POST, PUT, PATCH, DELETE)
			if r.Method == http.MethodGet || r.Method == http.MethodOptions || r.Method == http.MethodHead {
				next.ServeHTTP(w, r)
				return
			}

			idempotencyKey := r.Header.Get("Idempotency-Key")
			if idempotencyKey == "" {
				// If no key provided, proceed normally
				next.ServeHTTP(w, r)
				return
			}

			// Extract User ID from context or token
			var userID uuid.UUID
			if val, ok := r.Context().Value(UserIDContextKey).(uuid.UUID); ok {
				userID = val
			} else {
				userIdStr, err := utils.GetUserIdFromRequest(cfg, r, false)
				if err != nil {
					responses.Unauthorized(w, errors.New("unauthorized: missing or invalid authentication token"))
					return
				}
				parsedID, err := uuid.Parse(userIdStr)
				if err != nil {
					responses.Unauthorized(w, errors.New("invalid user id in token"))
					return
				}
				userID = parsedID
			}

			// Read request body to compute SHA-256 payload hash
			var bodyBytes []byte
			if r.Body != nil {
				var err error
				bodyBytes, err = io.ReadAll(r.Body)
				if err != nil {
					responses.BadRequest(w, errors.New("failed to read request body"))
					return
				}
				// Restore request body for downstream handlers
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			}

			payloadHash := utils.HashPayload(bodyBytes)

			// Attempt to acquire idempotency lock
			keyRecord, isNew, err := repo.AcquireLock(r.Context(), idempotencyKey, userID, r.URL.Path, payloadHash, lockDuration)
			if err != nil {
				if errors.Is(err, models.ErrIdempotencyConflict) {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusConflict)
					responses.JSON(w, http.StatusConflict, map[string]interface{}{
						"error":           "Concurrent request in progress with the same Idempotency-Key. Please retry later.",
						"idempotency_key": idempotencyKey,
					})
					return
				}

				if errors.Is(err, models.ErrIdempotencyPayloadDiff) {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusUnprocessableEntity)
					responses.JSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
						"error":           "Idempotency key reused with different request payload.",
						"idempotency_key": idempotencyKey,
					})
					return
				}

				logger.Logger.Errorf("Idempotency lock error: %v", err)
				responses.InternalServerError(w, err)
				return
			}

			// If this is a replay of a previously completed request, return cached response
			if !isNew && keyRecord.Status == models.IdempotencyStatusCompleted {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Idempotent-Replayed", "true")
				status := http.StatusOK
				if keyRecord.ResponseStatus != nil {
					status = *keyRecord.ResponseStatus
				}
				w.WriteHeader(status)
				if keyRecord.ResponseBody != nil {
					_, _ = w.Write(*keyRecord.ResponseBody)
				}
				return
			}

			// Wrap ResponseWriter to intercept and record the response
			rec := newResponseRecorder(w)

			// Process the request downstream
			next.ServeHTTP(rec, r)

			// Save the final response
			if rec.statusCode >= 200 && rec.statusCode < 500 {
				// Success or client error (deterministic) -> Save response
				err = repo.SaveResponse(context.Background(), idempotencyKey, userID, rec.statusCode, rec.body.Bytes())
				if err != nil {
					logger.Logger.Errorf("Failed to save idempotency response for key %s: %v", idempotencyKey, err)
				}
			} else {
				// Server error (5xx) -> Mark as failed to allow future retry
				_ = repo.MarkFailed(context.Background(), idempotencyKey, userID)
			}
		})
	}
}
