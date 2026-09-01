package middleware_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/bukharney/bank-core/internal/api/middleware"
	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
)

// MockIdempotencyRepository is an in-memory mock for idempotency testing
type MockIdempotencyRepository struct {
	mu      sync.Mutex
	records map[string]*models.IdempotencyKey
}

func newMockIdempotencyRepository() *MockIdempotencyRepository {
	return &MockIdempotencyRepository{
		records: make(map[string]*models.IdempotencyKey),
	}
}

func (m *MockIdempotencyRepository) AcquireLock(
	ctx context.Context,
	key string,
	userID uuid.UUID,
	path string,
	payloadHash string,
	lockDuration time.Duration,
) (*models.IdempotencyKey, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	lookupKey := key + ":" + userID.String()
	existing, exists := m.records[lookupKey]
	if !exists {
		rec := &models.IdempotencyKey{
			ID:          uuid.New(),
			Key:         key,
			UserID:      userID,
			RequestPath: path,
			RequestHash: payloadHash,
			Status:      models.IdempotencyStatusStarted,
			LockedUntil: time.Now().Add(lockDuration),
			CreatedAt:   time.Now(),
		}
		m.records[lookupKey] = rec
		return rec, true, nil
	}

	// Payload mismatch check
	if existing.RequestHash != payloadHash {
		return nil, false, models.ErrIdempotencyPayloadDiff
	}

	// Completed
	if existing.Status == models.IdempotencyStatusCompleted {
		return existing, false, nil
	}

	// In progress
	if existing.Status == models.IdempotencyStatusStarted && existing.LockedUntil.After(time.Now()) {
		return nil, false, models.ErrIdempotencyConflict
	}

	// Lock expired, reacquire
	existing.Status = models.IdempotencyStatusStarted
	existing.LockedUntil = time.Now().Add(lockDuration)
	return existing, true, nil
}

func (m *MockIdempotencyRepository) SaveResponse(ctx context.Context, key string, userID uuid.UUID, statusCode int, responseBody []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	lookupKey := key + ":" + userID.String()
	if rec, ok := m.records[lookupKey]; ok {
		raw := json.RawMessage(responseBody)
		rec.ResponseStatus = &statusCode
		rec.ResponseBody = &raw
		rec.Status = models.IdempotencyStatusCompleted
	}
	return nil
}

func (m *MockIdempotencyRepository) MarkFailed(ctx context.Context, key string, userID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	lookupKey := key + ":" + userID.String()
	if rec, ok := m.records[lookupKey]; ok {
		rec.Status = models.IdempotencyStatusFailed
	}
	return nil
}

func TestIdempotencyMiddleware_FirstRequestAndCachedReplay(t *testing.T) {
	mockRepo := newMockIdempotencyRepository()
	cfg := &config.Config{}
	userID := uuid.New()

	handlerExecutionCount := 0
	targetHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerExecutionCount++
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"success","receipt_id":"TX-1001"}`))
	})

	idempotencyMw := middleware.IdempotencyMiddleware(mockRepo, cfg, 30*time.Second)
	chain := idempotencyMw(targetHandler)

	payload := []byte(`{"sender_account_id":1,"receiver_account_id":2,"amount":5000}`)
	idempotencyKey := "idemp-key-001"

	// 1. First execution
	req1 := httptest.NewRequest(http.MethodPost, "/transaction/transfer", bytes.NewBuffer(payload))
	req1.Header.Set("Idempotency-Key", idempotencyKey)
	req1 = req1.WithContext(context.WithValue(req1.Context(), middleware.UserIDContextKey, userID))

	rec1 := httptest.NewRecorder()
	chain.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d, body: %s", rec1.Code, rec1.Body.String())
	}
	if handlerExecutionCount != 1 {
		t.Fatalf("expected handlerExecutionCount = 1, got %d", handlerExecutionCount)
	}

	// 2. Second execution with identical key and payload (Replay)
	req2 := httptest.NewRequest(http.MethodPost, "/transaction/transfer", bytes.NewBuffer(payload))
	req2.Header.Set("Idempotency-Key", idempotencyKey)
	req2 = req2.WithContext(context.WithValue(req2.Context(), middleware.UserIDContextKey, userID))

	rec2 := httptest.NewRecorder()
	chain.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected status 200 on replay, got %d", rec2.Code)
	}
	if rec2.Header().Get("X-Idempotent-Replayed") != "true" {
		t.Fatalf("expected X-Idempotent-Replayed header to be true")
	}
	if handlerExecutionCount != 1 {
		t.Fatalf("expected handler to NOT be executed again on replay, count = %d", handlerExecutionCount)
	}
}

func TestIdempotencyMiddleware_PayloadMismatch(t *testing.T) {
	mockRepo := newMockIdempotencyRepository()
	cfg := &config.Config{}
	userID := uuid.New()

	targetHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	idempotencyMw := middleware.IdempotencyMiddleware(mockRepo, cfg, 30*time.Second)
	chain := idempotencyMw(targetHandler)

	idempotencyKey := "idemp-key-diff-payload"

	// Request 1
	req1 := httptest.NewRequest(http.MethodPost, "/transaction/transfer", bytes.NewBuffer([]byte(`{"amount":1000}`)))
	req1.Header.Set("Idempotency-Key", idempotencyKey)
	req1 = req1.WithContext(context.WithValue(req1.Context(), middleware.UserIDContextKey, userID))
	rec1 := httptest.NewRecorder()
	chain.ServeHTTP(rec1, req1)

	// Request 2 with same key but changed amount (Payload mismatch attack/bug)
	req2 := httptest.NewRequest(http.MethodPost, "/transaction/transfer", bytes.NewBuffer([]byte(`{"amount":9999}`)))
	req2.Header.Set("Idempotency-Key", idempotencyKey)
	req2 = req2.WithContext(context.WithValue(req2.Context(), middleware.UserIDContextKey, userID))
	rec2 := httptest.NewRecorder()
	chain.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422 Unprocessable Entity for payload mismatch, got %d", rec2.Code)
	}
}
