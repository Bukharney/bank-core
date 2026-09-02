package atm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHTTPATMClient_DispenseCash_Success(t *testing.T) {
	// Mock ATM Server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/session":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"session_id": "test-session-123"})
		case "/atm/dispense":
			var req map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&req)
			if req["session_id"] != "test-session-123" {
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"status": "error", "message": "invalid session"})
				return
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Dispensed 500 units successfully"})
		case "/atm/health":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ATM server is running"))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := &HTTPATMClient{
		client: server.Client(),
		endpoints: map[int]string{
			1: server.URL,
		},
	}

	ctx := context.Background()

	// Test Health
	if !client.HealthCheck(ctx, 1) {
		t.Errorf("expected health check to return true")
	}

	// Test Dispense
	result, err := client.DispenseCash(ctx, 1, 50000)
	if err != nil {
		t.Fatalf("unexpected dispense error: %v", err)
	}

	if result.Status != "success" {
		t.Errorf("expected status 'success', got '%s'", result.Status)
	}
	if result.DispensedSat != 50000 {
		t.Errorf("expected 50000 satang, got %d", result.DispensedSat)
	}
}

func TestHTTPATMClient_DispenseCash_HardwareError(t *testing.T) {
	// Mock ATM Server returning cash jam
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/session":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"session_id": "test-session-456"})
		case "/atm/dispense":
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"status": "error", "message": "Cash dispenser mechanism jammed"})
		}
	}))
	defer server.Close()

	client := &HTTPATMClient{
		client: server.Client(),
		endpoints: map[int]string{
			1: server.URL,
		},
	}

	ctx := context.Background()
	_, err := client.DispenseCash(ctx, 1, 100000)
	if err == nil {
		t.Fatalf("expected error on hardware jam, got nil")
	}
	if !strings.Contains(err.Error(), "jammed") {
		t.Errorf("expected error to mention 'jammed', got: %v", err)
	}
}
