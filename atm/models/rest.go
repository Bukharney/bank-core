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
