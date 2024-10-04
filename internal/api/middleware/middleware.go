package middleware

import (
	"net/http"

	logger "github.com/bukharney/bank-core/internal/logs"
)

// LoggerMiddleware logs the request and response
func LoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger.Logger.Infof("Request: %s %s", r.Method, r.URL.Path)

		next.ServeHTTP(w, r)
	})
}

// PanicMiddleware recovers from panics and logs the error
func PanicMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if r := recover(); r != nil {
				logger.Logger.Errorf("Panic: %v", r)
				w.WriteHeader(http.StatusInternalServerError)
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
	CORSMiddleware,
)

// ApplyMiddleware applies the default middleware chain to a handler
func ApplyMiddleware(handler http.Handler) http.Handler {
	return DefaultMiddleware(handler)
}

// ApplyMiddlewareFunc applies the default middleware chain to a handler function
func ApplyMiddlewareFunc(handlerFunc http.HandlerFunc) http.Handler {
	return ApplyMiddleware(http.HandlerFunc(handlerFunc))
}
