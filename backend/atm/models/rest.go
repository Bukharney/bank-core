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

// DepositLookupRequest represents looking up recipient account by phone number
type DepositLookupRequest struct {
	PhoneNumber string `json:"phone_number"`
}

// DepositLookupResponse represents recipient preview for cash deposit
type DepositLookupResponse struct {
	Status              string `json:"status"`
	AccountID           int64  `json:"account_id,omitempty"`
	MaskedName          string `json:"masked_name,omitempty"`
	MaskedAccountNumber string `json:"masked_account_number,omitempty"`
	Currency            string `json:"currency,omitempty"`
	AccountType         string `json:"account_type,omitempty"`
	Message             string `json:"message,omitempty"`
}

// DepositCashRequest represents cash deposit request at ATM
type DepositCashRequest struct {
	PhoneNumber string         `json:"phone_number"`
	Amount      int64          `json:"amount"` // in Satang
	Notes       map[string]int `json:"notes,omitempty"`
}

// DepositCashResponse represents completed deposit receipt
type DepositCashResponse struct {
	Status              string `json:"status"`
	JournalID           string `json:"journal_id,omitempty"`
	ReferenceID         string `json:"reference_id,omitempty"`
	ATMID               int    `json:"atm_id,omitempty"`
	AccountID           int64  `json:"account_id,omitempty"`
	MaskedName          string `json:"masked_name,omitempty"`
	MaskedAccountNumber string `json:"masked_account_number,omitempty"`
	Amount              int64  `json:"amount,omitempty"`
	Currency            string `json:"currency,omitempty"`
	CreatedAt           string `json:"created_at,omitempty"`
	Message             string `json:"message,omitempty"`
}

