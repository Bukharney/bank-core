package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/bukharney/bank-core/atm/models"
)

// dispenseCash simulates dispensing cash.
func dispenseCash(w http.ResponseWriter, r *http.Request) {
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
			serv := &http.Server{
				Addr: fmt.Sprintf(":808%d", i+1),
				Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.URL.Path == "/atm/dispense" {
						dispenseCash(w, r)
					}
				},
				),
			}
			log.Printf("ATM server %d started", i+1)
			if err := serv.ListenAndServe(); err != nil {
				log.Fatalf("ATM server %d failed: %v", i+1, err)
			}

			defer serv.Close()
		}()
	}
}

func main() {
	spawnATMServer(3)
	select {}
}
