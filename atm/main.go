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

func main() {
	http.HandleFunc("/atm/dispense", dispenseCash)
	log.Println("ATM server is listening on port 8081...")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
