package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/bukharney/bank-core/atm/models"
	"github.com/bukharney/bank-core/atm/session"
)

func getBankCoreURL() string {
	if u := os.Getenv("BANK_CORE_URL"); u != "" {
		return u
	}
	return "http://localhost:8080"
}

// dispenseCash simulates dispensing cash with session ID.
func dispenseCash(w http.ResponseWriter, r *http.Request, s session.SessionM, atmID int) {
	var req models.DispenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	log.Printf("[ATM #%d] Received dispense request: SessionID=%s, Amount=%d", atmID, req.SessionID, req.Amount)

	if req.SessionID == "" || req.Amount <= 0 {
		http.Error(w, "Invalid session ID or amount", http.StatusBadRequest)
		return
	}

	ok := s.ValidateSession(req.SessionID)
	if !ok {
		log.Printf("[ATM #%d] Invalid session ID: %s", atmID, req.SessionID)
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
		log.Printf("[ATM #%d] Error dispensing cash: %v", atmID, err)
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

// claimCash processes Cardless OTP withdrawal with Phone Number + 6-digit PIN
func claimCash(w http.ResponseWriter, r *http.Request, atmID int) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req models.ClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.ClaimResponse{
			Status:  "error",
			Message: "Invalid request payload",
		})
		return
	}

	log.Printf("[ATM #%d] Received Phone + Code Claim: Phone=%s, Code=%s", atmID, req.PhoneNumber, req.Code)

	// 1. Verify with Bank Core
	verifyPayload, _ := json.Marshal(map[string]interface{}{
		"phone_number": req.PhoneNumber,
		"code":         req.Code,
		"atm_id":       atmID,
	})

	verifyResp, err := http.Post(fmt.Sprintf("%s/transaction/withdraw/verify", getBankCoreURL()), "application/json", bytes.NewReader(verifyPayload))
	if err != nil {
		log.Printf("[ATM #%d] Core communication error: %v", atmID, err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.ClaimResponse{
			Status:  "error",
			Message: "Bank Core engine unreachable",
		})
		return
	}
	defer verifyResp.Body.Close()

	if verifyResp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(verifyResp.Body).Decode(&errData)
		log.Printf("[ATM #%d] Verification failed: %s", atmID, errData.Error)
		w.WriteHeader(verifyResp.StatusCode)
		json.NewEncoder(w).Encode(models.ClaimResponse{
			Status:  "error",
			Message: errData.Error,
		})
		return
	}

	var verifyData struct {
		OrderID      string `json:"order_id"`
		CustomerName string `json:"customer_name"`
		Amount       int64  `json:"amount"`
		Currency     string `json:"currency"`
	}
	_ = json.NewDecoder(verifyResp.Body).Decode(&verifyData)

	log.Printf("[ATM #%d] Verified customer: %s, Amount: %d %s", atmID, verifyData.CustomerName, verifyData.Amount, verifyData.Currency)

	// 2. Physical Dispense Simulation
	units := int(verifyData.Amount / 100)
	if units <= 0 {
		units = 1
	}
	_ = simulateDispense(units)

	// 3. Confirm with Bank Core to commit double-entry bookkeeping
	confirmPayload, _ := json.Marshal(map[string]interface{}{
		"order_id": verifyData.OrderID,
		"atm_id":   atmID,
	})

	confirmResp, err := http.Post(fmt.Sprintf("%s/transaction/withdraw/confirm", getBankCoreURL()), "application/json", bytes.NewReader(confirmPayload))
	if err != nil || confirmResp.StatusCode != http.StatusOK {
		log.Printf("[ATM #%d] Warning: failed to confirm ledger with Bank Core: %v", atmID, err)
	} else {
		defer confirmResp.Body.Close()
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.ClaimResponse{
		Status:       "success",
		CustomerName: verifyData.CustomerName,
		Amount:       verifyData.Amount,
		Currency:     verifyData.Currency,
		Message:      fmt.Sprintf("Dispensed %d units successfully to %s", units, verifyData.CustomerName),
	})
}

// simulateDispense simulates the cash dispensing process.
func simulateDispense(amount int) error {
	log.Printf("Dispensing %d units...", amount)
	time.Sleep(500 * time.Millisecond)
	log.Println("Cash dispensed successfully")
	return nil
}

// depositLookup queries Bank Core to preview recipient account connected to phone number
func depositLookup(w http.ResponseWriter, r *http.Request, atmID int) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req models.DepositLookupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.DepositLookupResponse{
			Status:  "error",
			Message: "Invalid request payload",
		})
		return
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"phone_number": req.PhoneNumber,
	})

	resp, err := http.Post(fmt.Sprintf("%s/transaction/atm/deposit/lookup", getBankCoreURL()), "application/json", bytes.NewReader(payload))
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.DepositLookupResponse{
			Status:  "error",
			Message: "Bank Core engine unreachable",
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		w.WriteHeader(resp.StatusCode)
		json.NewEncoder(w).Encode(models.DepositLookupResponse{
			Status:  "error",
			Message: errData.Error,
		})
		return
	}

	var lookupData struct {
		AccountID           int64  `json:"account_id"`
		MaskedName          string `json:"masked_name"`
		MaskedAccountNumber string `json:"masked_account_number"`
		Currency            string `json:"currency"`
		AccountType         string `json:"account_type"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&lookupData)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.DepositLookupResponse{
		Status:              "success",
		AccountID:           lookupData.AccountID,
		MaskedName:          lookupData.MaskedName,
		MaskedAccountNumber: lookupData.MaskedAccountNumber,
		Currency:            lookupData.Currency,
		AccountType:         lookupData.AccountType,
	})
}

// depositCash accepts cash notes and calls Bank Core to commit double-entry ledger
func depositCash(w http.ResponseWriter, r *http.Request, atmID int) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req models.DepositCashRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.DepositCashResponse{
			Status:  "error",
			Message: "Invalid request payload",
		})
		return
	}

	log.Printf("[ATM #%d] Received Cash Deposit: Phone=%s, Amount=%d", atmID, req.PhoneNumber, req.Amount)

	// Simulate banknote ingestion and validation
	time.Sleep(300 * time.Millisecond)

	corePayload, _ := json.Marshal(map[string]interface{}{
		"atm_id":       atmID,
		"phone_number": req.PhoneNumber,
		"amount":       req.Amount,
		"notes":        req.Notes,
	})

	coreResp, err := http.Post(fmt.Sprintf("%s/transaction/atm/deposit", getBankCoreURL()), "application/json", bytes.NewReader(corePayload))
	if err != nil {
		log.Printf("[ATM #%d] Core communication error: %v", atmID, err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.DepositCashResponse{
			Status:  "error",
			Message: "Bank Core engine unreachable",
		})
		return
	}
	defer coreResp.Body.Close()

	if coreResp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(coreResp.Body).Decode(&errData)
		w.WriteHeader(coreResp.StatusCode)
		json.NewEncoder(w).Encode(models.DepositCashResponse{
			Status:  "error",
			Message: errData.Error,
		})
		return
	}

	var receipt struct {
		JournalID           string `json:"journal_id"`
		ReferenceID         string `json:"reference_id"`
		ATMID               int    `json:"atm_id"`
		AccountID           int64  `json:"account_id"`
		MaskedName          string `json:"masked_name"`
		MaskedAccountNumber string `json:"masked_account_number"`
		Amount              int64  `json:"amount"`
		Currency            string `json:"currency"`
		CreatedAt           string `json:"created_at"`
	}
	_ = json.NewDecoder(coreResp.Body).Decode(&receipt)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.DepositCashResponse{
		Status:              "success",
		JournalID:           receipt.JournalID,
		ReferenceID:         receipt.ReferenceID,
		ATMID:               receipt.ATMID,
		AccountID:           receipt.AccountID,
		MaskedName:          receipt.MaskedName,
		MaskedAccountNumber: receipt.MaskedAccountNumber,
		Amount:              receipt.Amount,
		Currency:            receipt.Currency,
		CreatedAt:           receipt.CreatedAt,
		Message:             fmt.Sprintf("Deposited %d Satang successfully to %s", receipt.Amount, receipt.MaskedName),
	})
}

func spawnATMServer(n int) {
	for i := 0; i < n; i++ {
		atmIdx := i + 1
		go func(atmID int) {
			s := session.NewSession()
			mux := http.NewServeMux()
			mux.HandleFunc("/atm/dispense", func(w http.ResponseWriter, r *http.Request) {
				dispenseCash(w, r, s, atmID)
			})
			mux.HandleFunc("/atm/claim", func(w http.ResponseWriter, r *http.Request) {
				claimCash(w, r, atmID)
			})
			mux.HandleFunc("/atm/deposit/lookup", func(w http.ResponseWriter, r *http.Request) {
				depositLookup(w, r, atmID)
			})
			mux.HandleFunc("/atm/deposit", func(w http.ResponseWriter, r *http.Request) {
				depositCash(w, r, atmID)
			})
			mux.HandleFunc("/atm/health", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(fmt.Sprintf("ATM #%d is online and running", atmID)))
			})
			mux.Handle("/session", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(fmt.Sprintf(`{"session_id": "%s"}`, s.CreateSession(5*time.Minute))))
			}))
			log.Printf("ATM #%d started on :808%d", atmID, atmID)
			log.Fatal(http.ListenAndServe(fmt.Sprintf(":808%d", atmID), mux))
		}(atmIdx)
	}
}

func main() {
	spawnATMServer(3)
	select {}
}

