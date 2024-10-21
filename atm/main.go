package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/bukharney/bank-core/atm/models"
	"github.com/bukharney/bank-core/atm/session"
)

// dispenseCash simulates dispensing cash.
func dispenseCash(w http.ResponseWriter, r *http.Request, s session.Session) {
	var req models.DispenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	log.Printf("Received dispense request: SessionID=%s, Amount=%d", req.SessionID, req.Amount)

	if req.SessionID == "" || req.Amount <= 0 {
		http.Error(w, "Invalid session ID or amount", http.StatusBadRequest)
		return
	}

	ok := s.ValidateSession(req.SessionID)
	if !ok {
		log.Printf("Invalid session ID: %s", req.SessionID)
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.DispenseResponse{
			Status:  "error",
			Message: "Invalid session ID",
		})
		return
	}

	// Simulate the cash dispensing logic
	err := simulateDispense(req.Amount)
	if err != nil {
		log.Printf("Error dispensing cash: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.DispenseResponse{
			Status:  "error",
			Message: "Failed to dispense cash",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.DispenseResponse{
		Status:  "success",
		Message: fmt.Sprintf("Dispensed %d units successfully", req.Amount),
	})
}

// simulateDispense simulates the cash dispensing process.
func simulateDispense(amount int) error {
	log.Printf("Dispensing %d units...", amount)
	time.Sleep(500 * time.Millisecond)
	log.Println("Cash dispensed successfully")
	return nil
}

func spawnATMServer(n int) {
	for i := 0; i < n; i++ {
		go func() {
			s := session.NewSession()
			mux := http.NewServeMux()
			mux.HandleFunc("/atm/dispense", func(w http.ResponseWriter, r *http.Request) {
				dispenseCash(w, r, s)
			})
			mux.HandleFunc("/atm/health", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("ATM server is running"))
			})
			mux.Handle("/session", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(fmt.Sprintf(`{"session_id": "%s"}`, s.CreateSession())))
			}))
			log.Printf("ATM server started on :808%d", i)
			log.Fatal(http.ListenAndServe(fmt.Sprintf(":808%d", i+1), mux))
		}()
	}
}

func main() {
	spawnATMServer(3)
	select {}
}
