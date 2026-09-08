package usecases

import (
	"fmt"
	"strings"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
)

type AdminUsecase struct {
	Cfg         *config.Config
	AdminRepo   models.AdminRepository
	UserUsecase models.UserUsecase
}

func NewAdminUsecase(
	cfg *config.Config,
	adminRepo models.AdminRepository,
	userUsecase models.UserUsecase,
) models.AdminUsecase {
	return &AdminUsecase{
		Cfg:         cfg,
		AdminRepo:   adminRepo,
		UserUsecase: userUsecase,
	}
}

func (u *AdminUsecase) GetOverview() (*models.AdminOverviewResponse, error) {
	rawAccounts, err := u.AdminRepo.GetSystemAccounts()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch system accounts: %w", err)
	}

	var totalLiquidity int64
	accounts := make([]models.SystemAccountOverview, len(rawAccounts))
	for i, acc := range rawAccounts {
		totalLiquidity += acc.BalanceSatang

		label := acc.AccountNumber
		category := "SYSTEM_SETTLEMENT"

		if acc.AccountNumber == "SYS-CASH-SETTLE" {
			label = "Central Clearing & Settlement"
			category = "CENTRAL_SETTLEMENT"
		} else if strings.HasPrefix(acc.AccountNumber, "ATM-VAULT-") {
			terminalNum := strings.TrimPrefix(acc.AccountNumber, "ATM-VAULT-")
			label = fmt.Sprintf("Terminal #%s Vault", terminalNum)
			category = "ATM_VAULT"
		}

		acc.Label = label
		acc.Category = category
		accounts[i] = acc
	}

	customerDeposits, activeAccounts, err := u.AdminRepo.GetCustomerAggregates()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch customer aggregates: %w", err)
	}

	usersCount, err := u.AdminRepo.GetTotalUsersCount()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user count: %w", err)
	}

	txCount, txVolume, err := u.AdminRepo.GetTransactions24hMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch transaction metrics: %w", err)
	}

	health, err := u.AdminRepo.GetLedgerHealth()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch ledger health: %w", err)
	}

	return &models.AdminOverviewResponse{
		SystemAccounts:        accounts,
		TotalSystemLiquidity:  totalLiquidity,
		TotalCustomerDeposits: customerDeposits,
		ActiveAccountsCount:   activeAccounts,
		TotalUsersCount:       usersCount,
		Transactions24hCount:  txCount,
		Transactions24hVolume: txVolume,
		LedgerHealth:          health,
	}, nil
}

func (u *AdminUsecase) ListUsers(search string, role string, limit, offset int) ([]models.User, int, error) {
	return u.UserUsecase.ListUsers(search, role, limit, offset)
}

func (u *AdminUsecase) UpdateRole(adminID, targetUserID uuid.UUID, role string) error {
	return u.UserUsecase.UpdateRole(adminID, targetUserID, role)
}
