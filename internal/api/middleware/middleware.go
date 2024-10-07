package middleware

import (
	"net/http"
	"runtime/debug"

	logger "github.com/bukharney/bank-core/internal/logs"
)

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

// AuthMiddleware checks if the user is authenticated
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if the user is authenticated
		// If not, return a 401 Unauthorized response
		// If the user is authenticated, call next.ServeHTTP(w, r)

		next.ServeHTTP(w, r)
	})
}

// LoggerMiddleware logs the request and response
func LoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Wrap the ResponseWriter to capture the status code
		srw := &statusResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(srw, r)

		logger.Logger.Infof("[%s] %s %s %d", r.Method, r.URL.Path, r.RemoteAddr, srw.statusCode)
	})
}

// PanicMiddleware recovers from panics and logs the error
func PanicMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if r := recover(); r != nil {
				debug.PrintStack()
				http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
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
