package middleware

import (
	"context"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/bukharney/bank-core/internal/config"
	logger "github.com/bukharney/bank-core/internal/logs"
	"github.com/bukharney/bank-core/internal/metrics"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
)

var unprotectedRoutes = map[string]bool{
	"/metrics":                      true,
	"/user/register":                true,
	"/auth/login":                   true,
	"/auth/refresh":                 true,
	"/auth/logout":                  true,
	"/auth/test":                    true,
	"/transaction/withdraw/verify":  true,
	"/transaction/withdraw/confirm": true,
	"/transaction/atm/deposit/lookup": true,
	"/transaction/atm/deposit":        true,
}

// statusResponseWriter wraps http.ResponseWriter to capture the status code
type statusResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

// WriteHeader captures the status code and calls the original WriteHeader
func (w *statusResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

// Write calls the original Write and returns the status code
func (w *statusResponseWriter) Write(b []byte) (int, error) {
	return w.ResponseWriter.Write(b)
}

// TimeoutMiddleware adds a timeout to the request
func TimeoutMiddleware(next http.Handler) http.Handler {
	timeout := 30
	return http.TimeoutHandler(next, time.Duration(timeout)*time.Second, "Request timed out")
}

// AuthMiddleware checks if the user is authenticated
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cfg := config.NewConfig()
		if _, ok := unprotectedRoutes[r.URL.Path]; ok || strings.HasPrefix(r.URL.Path, "/account/preview/") {
			next.ServeHTTP(w, r)
			return
		}

		token, err := utils.ExtractToken(r, "access_token")
		if err != nil {
			if err.Error() == "http: named cookie not present" {
				responses.Unauthorized(w, err)
				return
			}

			responses.BadRequest(w, err)
			return
		}

		userIdStr, err := utils.GetUserIdFromToken(cfg, token, false)
		if err != nil {
			responses.Unauthorized(w, err)
			return
		}

		parsedID, err := utils.ParseUUID(userIdStr)
		if err != nil {
			responses.Unauthorized(w, err)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDContextKey, parsedID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// LoggerMiddleware logs the request, response, and records Prometheus HTTP metrics
func LoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		// Wrap the ResponseWriter to capture the status code
		srw := &statusResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(srw, r)

		duration := time.Since(start).Seconds()

		// Record Prometheus HTTP Metrics (skip /metrics itself from pollution)
		if r.URL.Path != "/metrics" {
			metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, strconv.Itoa(srw.statusCode)).Inc()
			metrics.HTTPRequestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(duration)
		}

		logger.Logger.Infof("[%s] %s %s %d (%.2fms)", r.Method, r.URL.Path, r.RemoteAddr, srw.statusCode, duration*1000)
	})
}

// PanicMiddleware recovers from panics and logs the error
func PanicMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if r := recover(); r != nil {
				debug.PrintStack()
				logger.Logger.Errorf("Panic: %v", r)
				responses.Error(w, http.StatusInternalServerError, nil)
			}
		}()

		next.ServeHTTP(w, r)
	})
}

// CORSMiddleware adds the necessary headers for CORS
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		next.ServeHTTP(w, r)
	})
}

// ChainMiddleware chains multiple middlewares together
func ChainMiddleware(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			next = middlewares[i](next)
		}
		return next
	}
}

// DefaultMiddleware is the default middleware chain
var DefaultMiddleware = ChainMiddleware(
	LoggerMiddleware,
	PanicMiddleware,
	AuthMiddleware,
	CORSMiddleware,
	TimeoutMiddleware,
)

// ApplyMiddleware applies the default middleware chain to a handler
func ApplyMiddleware(handler http.Handler) http.Handler {
	return DefaultMiddleware(handler)
}

// ApplyMiddlewareFunc applies the default middleware chain to a handler function
func ApplyMiddlewareFunc(handlerFunc http.HandlerFunc) http.Handler {
	return ApplyMiddleware(http.HandlerFunc(handlerFunc))
}
