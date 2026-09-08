package models

import "github.com/google/uuid"

type SystemAccountOverview struct {
	ID            int64  `json:"id" db:"id"`
	AccountNumber string `json:"account_number" db:"account_number"`
	Label         string `json:"label" db:"-"`
	Category      string `json:"category" db:"-"`
	BalanceSatang int64  `json:"balance_satang" db:"balance"`
	Currency      string `json:"currency" db:"currency"`
	Status        string `json:"status" db:"status"`
}

type LedgerHealthStatus struct {
	InvariantOK         bool  `json:"invariant_ok"`
	TotalDebits         int64 `json:"total_debits"`
	TotalCredits        int64 `json:"total_credits"`
	LeakageSatang       int64 `json:"leakage_satang"`
	PendingOutboxEvents int64 `json:"pending_outbox_events"`
}

type AdminOverviewResponse struct {
	SystemAccounts        []SystemAccountOverview `json:"system_accounts"`
	TotalSystemLiquidity  int64                   `json:"total_system_liquidity"`
	TotalCustomerDeposits int64                   `json:"total_customer_deposits"`
	ActiveAccountsCount   int64                   `json:"active_accounts_count"`
	TotalUsersCount       int64                   `json:"total_users_count"`
	Transactions24hCount  int64                   `json:"transactions_24h_count"`
	Transactions24hVolume int64                   `json:"transactions_24h_volume"`
	LedgerHealth          LedgerHealthStatus      `json:"ledger_health"`
}

type AdminRepository interface {
	GetSystemAccounts() ([]SystemAccountOverview, error)
	GetCustomerAggregates() (totalDeposits int64, activeAccounts int64, err error)
	GetTotalUsersCount() (int64, error)
	GetTransactions24hMetrics() (count int64, volume int64, err error)
	GetLedgerHealth() (LedgerHealthStatus, error)
}

type AdminUsecase interface {
	GetOverview() (*AdminOverviewResponse, error)
	ListUsers(search string, role string, limit, offset int) ([]User, int, error)
	UpdateRole(adminID, targetUserID uuid.UUID, role string) error
}
