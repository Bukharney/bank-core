package usecases_test

import (
	"errors"
	"testing"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type mockAccountRepo struct {
	accounts map[int64]*models.Account
}

func (m *mockAccountRepo) CreateAccount(tx *sqlx.Tx, account *models.Account) error {
	m.accounts[account.ID] = account
	return nil
}

func (m *mockAccountRepo) GetAccountByID(accountID int64) (*models.Account, error) {
	if a, ok := m.accounts[accountID]; ok {
		return a, nil
	}
	return nil, errors.New("not found")
}

func (m *mockAccountRepo) GetAccountByIDForUpdate(tx *sqlx.Tx, accountID int64) (*models.Account, error) {
	return m.GetAccountByID(accountID)
}

func (m *mockAccountRepo) GetAccountsByUserID(userID uuid.UUID) ([]*models.Account, error) {
	var res []*models.Account
	for _, a := range m.accounts {
		if a.UserID == userID {
			res = append(res, a)
		}
	}
	return res, nil
}

func (m *mockAccountRepo) GetAccountByNumber(accountNumber string) (*models.Account, error) {
	for _, a := range m.accounts {
		if a.AccountNumber == accountNumber {
			return a, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockAccountRepo) GetAccountByLinkedPhone(phone string) (*models.Account, error) {
	for _, a := range m.accounts {
		if a.LinkedPhone != nil && *a.LinkedPhone == phone {
			return a, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockAccountRepo) LinkPhone(userID uuid.UUID, accountID int64, phone string) error {
	for _, a := range m.accounts {
		if a.UserID == userID || (a.LinkedPhone != nil && *a.LinkedPhone == phone) {
			a.LinkedPhone = nil
		}
	}
	if a, ok := m.accounts[accountID]; ok {
		a.LinkedPhone = &phone
		return nil
	}
	return errors.New("not found")
}

func (m *mockAccountRepo) UnlinkPhone(userID uuid.UUID, accountID int64) error {
	if a, ok := m.accounts[accountID]; ok {
		a.LinkedPhone = nil
		return nil
	}
	return errors.New("not found")
}

func (m *mockAccountRepo) UpdateBalance(tx *sqlx.Tx, accountID int64, newBalance int64, currentVersion int64) error {
	if a, ok := m.accounts[accountID]; ok {
		a.Balance = newBalance
		return nil
	}
	return errors.New("not found")
}

func (m *mockAccountRepo) UpdateStatus(accountID int64, status string) error {
	if a, ok := m.accounts[accountID]; ok {
		a.Status = status
		return nil
	}
	return errors.New("not found")
}

func TestLinkPhoneToAccount(t *testing.T) {
	userID := uuid.New()
	phone := "0812345678"

	userRepo := &mockUserRepo{
		users: map[uuid.UUID]*models.User{
			userID: {
				ID:          userID,
				PhoneNumber: &phone,
			},
		},
	}

	accRepo := &mockAccountRepo{
		accounts: map[int64]*models.Account{
			1: {
				ID:            1,
				UserID:        userID,
				AccountNumber: "1234567890",
				Status:        models.AccountStatusActive,
			},
			2: {
				ID:            2,
				UserID:        userID,
				AccountNumber: "9876543210",
				Status:        models.AccountStatusActive,
			},
		},
	}

	cfg := &config.Config{}
	accountUsecase := usecases.NewAccountUsecase(cfg, accRepo, userRepo)

	// Link Account #1
	linked, err := accountUsecase.LinkPhone(userID, &models.LinkPhoneRequest{AccountID: 1})
	if err != nil {
		t.Fatalf("unexpected error linking phone: %v", err)
	}
	if linked.LinkedPhone == nil || *linked.LinkedPhone != phone {
		t.Fatalf("expected linked_phone to be %s, got %v", phone, linked.LinkedPhone)
	}

	// Lookup by linked phone
	found, err := accountUsecase.GetAccountByLinkedPhone(phone)
	if err != nil {
		t.Fatalf("unexpected error finding linked account: %v", err)
	}
	if found.ID != 1 {
		t.Fatalf("expected account ID 1, got %d", found.ID)
	}

	// Switch link to Account #2
	linked2, err := accountUsecase.LinkPhone(userID, &models.LinkPhoneRequest{AccountID: 2})
	if err != nil {
		t.Fatalf("unexpected error switching phone link: %v", err)
	}
	if linked2.LinkedPhone == nil || *linked2.LinkedPhone != phone {
		t.Fatalf("expected account 2 to have linked_phone %s", phone)
	}

	// Account #1 should now be unlinked
	acc1, _ := accRepo.GetAccountByID(1)
	if acc1.LinkedPhone != nil {
		t.Fatalf("expected account 1 to be unlinked, got %v", *acc1.LinkedPhone)
	}

	// Unlink Account #2
	err = accountUsecase.UnlinkPhone(userID, &models.UnlinkPhoneRequest{AccountID: 2})
	if err != nil {
		t.Fatalf("unexpected error unlinking phone: %v", err)
	}
	acc2, _ := accRepo.GetAccountByID(2)
	if acc2.LinkedPhone != nil {
		t.Fatalf("expected account 2 to be unlinked after UnlinkPhone")
	}
}

func TestATMDepositLookup_SuccessAndFailure(t *testing.T) {
	userID := uuid.New()
	phone := "0898765432"

	accRepo := &mockAccountRepo{
		accounts: map[int64]*models.Account{
			10: {
				ID:                10,
				UserID:            userID,
				AccountNumber:     "0123456789",
				AccountHolderName: "Somchai Dee",
				Currency:          "THB",
				AccountType:       models.AccountTypeSavings,
				Status:            models.AccountStatusActive,
				LinkedPhone:       &phone,
			},
		},
	}

	transferUsecase := usecases.NewTransferUsecase(
		&config.Config{},
		nil,
		accRepo,
		nil,
		nil,
		nil,
		nil,
	)

	// Successful Lookup
	res, err := transferUsecase.ATMDepositLookup(&models.ATMDepositLookupRequest{
		PhoneNumber: "089-876-5432",
	})
	if err != nil {
		t.Fatalf("expected successful lookup, got: %v", err)
	}
	if res.MaskedName != "S****** D**" {
		t.Fatalf("expected masked name S****** D**, got: %s", res.MaskedName)
	}
	if res.MaskedAccountNumber != "***-***6789" {
		t.Fatalf("expected masked account ***-***6789, got: %s", res.MaskedAccountNumber)
	}

	// Failed Lookup (unregistered phone)
	_, err = transferUsecase.ATMDepositLookup(&models.ATMDepositLookupRequest{
		PhoneNumber: "0800000000",
	})
	if err == nil {
		t.Fatalf("expected error for unlinked phone, got nil")
	}

	// Deposit Denomination Validation Check
	_, err = transferUsecase.ATMDeposit(&models.ATMDepositRequest{
		PhoneNumber: phone,
		Amount:      5050, // 50.50 THB (not multiple of 100 THB)
	}, "")
	if err == nil {
		t.Fatalf("expected error for non-multiple of 100 THB deposit, got nil")
	}
}

