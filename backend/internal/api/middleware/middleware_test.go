package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bukharney/bank-core/internal/api/middleware"
)

func TestCORSMiddleware_PreflightOptions(t *testing.T) {
	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
	})

	handler := middleware.CORSMiddleware(next)

	req := httptest.NewRequest(http.MethodOptions, "/transaction/transfer", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if nextCalled {
		t.Fatalf("expected next handler NOT to be called on OPTIONS preflight")
	}

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected status 204 No Content, got %d", w.Code)
	}

	if origin := w.Header().Get("Access-Control-Allow-Origin"); origin != "http://localhost:3000" {
		t.Fatalf("expected Access-Control-Allow-Origin to be 'http://localhost:3000', got %q", origin)
	}

	if creds := w.Header().Get("Access-Control-Allow-Credentials"); creds != "true" {
		t.Fatalf("expected Access-Control-Allow-Credentials to be 'true', got %q", creds)
	}

	headers := w.Header().Get("Access-Control-Allow-Headers")
	if headers == "" {
		t.Fatalf("expected Access-Control-Allow-Headers to be set")
	}
}

func TestCORSMiddleware_WildcardWithoutOrigin(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware.CORSMiddleware(next)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if origin := w.Header().Get("Access-Control-Allow-Origin"); origin != "*" {
		t.Fatalf("expected Access-Control-Allow-Origin to be '*', got %q", origin)
	}
}

func TestAuthMiddleware_OptionsBypass(t *testing.T) {
	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	// Wrap a protected route in AuthMiddleware
	handler := middleware.AuthMiddleware(next)

	// Send OPTIONS request without access_token cookie
	req := httptest.NewRequest(http.MethodOptions, "/account/123", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !nextCalled {
		t.Fatalf("expected AuthMiddleware to pass through OPTIONS request without checking auth")
	}
}

func TestDefaultMiddleware_PreflightOptions(t *testing.T) {
	protectedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware.ApplyMiddleware(protectedHandler)

	req := httptest.NewRequest(http.MethodOptions, "/transaction/transfer", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected status 204 No Content for preflight through DefaultMiddleware, got %d", w.Code)
	}

	if origin := w.Header().Get("Access-Control-Allow-Origin"); origin != "http://localhost:3000" {
		t.Fatalf("expected Access-Control-Allow-Origin to be 'http://localhost:3000', got %q", origin)
	}
}
