package models

// DispenseRequest represents the request structure for a dispense operation.
type DispenseRequest struct {
	SessionID string `json:"session_id"`
	Amount    int    `json:"amount"`
}

// DispenseResponse represents the response structure.
type DispenseResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// ClaimRequest represents the request payload when a customer enters Phone + 6-digit PIN at ATM.
type ClaimRequest struct {
	PhoneNumber string `json:"phone_number"`
	Code        string `json:"code"`
}

// ClaimResponse represents the outcome of ATM verification and cash dispense.
type ClaimResponse struct {
	Status       string `json:"status"`
	CustomerName string `json:"customer_name,omitempty"`
	Amount       int64  `json:"amount,omitempty"`
	Currency     string `json:"currency,omitempty"`
	Message      string `json:"message"`
}
