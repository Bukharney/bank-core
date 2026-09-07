package controllers_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bukharney/bank-core/internal/api/controllers"
	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type mockLedgerUsecase struct {
	statements map[int64][]*models.LedgerEntry
	journals   map[uuid.UUID]*models.JournalEntry
}

func (m *mockLedgerUsecase) PostJournal(tx *sqlx.Tx, req *models.CreateJournalRequest) (*models.JournalEntry, error) {
	return nil, nil
}

func (m *mockLedgerUsecase) GetAccountStatement(accountID int64, limit int, offset int) ([]*models.LedgerEntry, error) {
	if entries, ok := m.statements[accountID]; ok {
		return entries, nil
	}
	return []*models.LedgerEntry{}, nil
}

func (m *mockLedgerUsecase) GetJournalDetails(journalID uuid.UUID) (*models.JournalEntry, error) {
	if j, ok := m.journals[journalID]; ok {
		return j, nil
	}
	return nil, errors.New("not found")
}

type mockAccountRepoForLedger struct {
	accounts map[int64]*models.Account
}

func (m *mockAccountRepoForLedger) CreateAccount(tx *sqlx.Tx, account *models.Account) error {
	return nil
}

func (m *mockAccountRepoForLedger) GetAccountByID(accountID int64) (*models.Account, error) {
	if acc, ok := m.accounts[accountID]; ok {
		return acc, nil
	}
	return nil, errors.New("not found")
}

func (m *mockAccountRepoForLedger) GetAccountByIDForUpdate(tx *sqlx.Tx, accountID int64) (*models.Account, error) {
	return m.GetAccountByID(accountID)
}

func (m *mockAccountRepoForLedger) GetAccountsByUserID(userID uuid.UUID) ([]*models.Account, error) {
	var result []*models.Account
	for _, acc := range m.accounts {
		if acc.UserID == userID {
			result = append(result, acc)
		}
	}
	return result, nil
}

func (m *mockAccountRepoForLedger) GetAccountByNumber(accountNumber string) (*models.Account, error) {
	return nil, nil
}

func (m *mockAccountRepoForLedger) UpdateBalance(tx *sqlx.Tx, accountID int64, newBalance int64, currentVersion int64) error {
	return nil
}

func (m *mockAccountRepoForLedger) UpdateStatus(accountID int64, status string) error {
	return nil
}

func (m *mockAccountRepoForLedger) GetAccountByLinkedPhone(phone string) (*models.Account, error) {
	return nil, errors.New("not found")
}

func (m *mockAccountRepoForLedger) LinkPhone(userID uuid.UUID, accountID int64, phone string) error {
	return nil
}

func (m *mockAccountRepoForLedger) UnlinkPhone(userID uuid.UUID, accountID int64) error {
	return nil
}

func setupLedgerControllerTest() (*config.Config, *mockLedgerUsecase, *mockAccountRepoForLedger, *controllers.LedgerController) {
	cfg := &config.Config{
		JWTSecret: map[bool]string{
			false: "test-access-secret",
			true:  "test-refresh-secret",
		},
	}
	uc := &mockLedgerUsecase{
		statements: make(map[int64][]*models.LedgerEntry),
		journals:   make(map[uuid.UUID]*models.JournalEntry),
	}
	repo := &mockAccountRepoForLedger{
		accounts: make(map[int64]*models.Account),
	}
	ctrl := controllers.NewLedgerController(cfg, uc, repo)
	return cfg, uc, repo, ctrl
}

func TestGetAccountStatementHandler_OwnerAccess(t *testing.T) {
	cfg, uc, repo, ctrl := setupLedgerControllerTest()

	ownerID := uuid.New()
	token, err := utils.GenerateToken(cfg, ownerID, false)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	repo.accounts[10] = &models.Account{
		ID:            10,
		AccountNumber: "1234567890",
		UserID:        ownerID,
	}

	uc.statements[10] = []*models.LedgerEntry{
		{
			ID:           1,
			AccountID:    10,
			EntryType:    models.EntryTypeCredit,
			Amount:       50000,
			BalanceAfter: 50000,
			CreatedAt:    time.Now(),
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/ledger/statement/10", nil)
	req.SetPathValue("id", "10")
	req.AddCookie(&http.Cookie{Name: "access_token", Value: token})
	w := httptest.NewRecorder()

	ctrl.GetAccountStatementHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 for owner, got %d: %s", w.Code, w.Body.String())
	}

	var entries []*models.LedgerEntry
	if err := json.Unmarshal(w.Body.Bytes(), &entries); err != nil {
		t.Fatalf("failed to decode entries: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
}

func TestGetAccountStatementHandler_ForeignAccountForbidden(t *testing.T) {
	cfg, _, repo, ctrl := setupLedgerControllerTest()

	ownerID := uuid.New()
	callerID := uuid.New()

	callerToken, err := utils.GenerateToken(cfg, callerID, false)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	repo.accounts[10] = &models.Account{
		ID:            10,
		AccountNumber: "1234567890",
		UserID:        ownerID,
	}

	// Caller attempts to access Jane Doe's statement
	req := httptest.NewRequest(http.MethodGet, "/ledger/statement/10", nil)
	req.SetPathValue("id", "10")
	req.AddCookie(&http.Cookie{Name: "access_token", Value: callerToken})
	w := httptest.NewRecorder()

	ctrl.GetAccountStatementHandler(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 Forbidden for foreign account statement, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetAccountStatementHandler_Unauthenticated(t *testing.T) {
	_, _, repo, ctrl := setupLedgerControllerTest()

	repo.accounts[10] = &models.Account{
		ID:            10,
		AccountNumber: "1234567890",
		UserID:        uuid.New(),
	}

	req := httptest.NewRequest(http.MethodGet, "/ledger/statement/10", nil)
	w := httptest.NewRecorder()

	ctrl.GetAccountStatementHandler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 Unauthorized, got %d", w.Code)
	}
}

func TestGetJournalDetails_Authorized(t *testing.T) {
	cfg, uc, repo, ctrl := setupLedgerControllerTest()

	ownerID := uuid.New()
	token, err := utils.GenerateToken(cfg, ownerID, false)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	repo.accounts[10] = &models.Account{
		ID:            10,
		AccountNumber: "1234567890",
		UserID:        ownerID,
	}

	journalID := uuid.New()
	uc.journals[journalID] = &models.JournalEntry{
		ID:              journalID,
		ReferenceID:     "REF-123",
		TransactionType: models.TransactionTypeTransfer,
		Description:     "Transfer payment",
		Status:          models.JournalStatusPosted,
		PostedAt:        time.Now(),
		Postings: []models.LedgerEntry{
			{
				ID:             1,
				JournalEntryID: journalID,
				AccountID:      10, // Belongs to owner
				EntryType:      models.EntryTypeDebit,
				Amount:         25000,
				BalanceAfter:   75000,
				Sequence:       1,
			},
			{
				ID:             2,
				JournalEntryID: journalID,
				AccountID:      20, // Counterparty account
				EntryType:      models.EntryTypeCredit,
				Amount:         25000,
				BalanceAfter:   125000,
				Sequence:       2,
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/ledger/journal/"+journalID.String(), nil)
	req.SetPathValue("id", journalID.String())
	req.AddCookie(&http.Cookie{Name: "access_token", Value: token})
	w := httptest.NewRecorder()

	ctrl.GetJournalDetailsHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK for authorized owner, got %d: %s", w.Code, w.Body.String())
	}

	var res models.JournalEntry
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res.ID != journalID {
		t.Fatalf("expected journal ID %s, got %s", journalID, res.ID)
	}
}

func TestGetJournalDetails_Forbidden(t *testing.T) {
	cfg, uc, repo, ctrl := setupLedgerControllerTest()

	strangerID := uuid.New()
	strangerToken, err := utils.GenerateToken(cfg, strangerID, false)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// Stranger owns account 999
	repo.accounts[999] = &models.Account{
		ID:            999,
		AccountNumber: "9999999999",
		UserID:        strangerID,
	}

	// Journal involves accounts 10 and 20 (neither owned by stranger)
	journalID := uuid.New()
	uc.journals[journalID] = &models.JournalEntry{
		ID:              journalID,
		ReferenceID:     "REF-SECRET",
		TransactionType: models.TransactionTypeTransfer,
		Description:     "Secret settlement",
		Status:          models.JournalStatusPosted,
		PostedAt:        time.Now(),
		Postings: []models.LedgerEntry{
			{
				ID:             1,
				JournalEntryID: journalID,
				AccountID:      10,
				EntryType:      models.EntryTypeDebit,
				Amount:         100000,
				BalanceAfter:   0,
				Sequence:       1,
			},
			{
				ID:             2,
				JournalEntryID: journalID,
				AccountID:      20,
				EntryType:      models.EntryTypeCredit,
				Amount:         100000,
				BalanceAfter:   200000,
				Sequence:       2,
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/ledger/journal/"+journalID.String(), nil)
	req.SetPathValue("id", journalID.String())
	req.AddCookie(&http.Cookie{Name: "access_token", Value: strangerToken})
	w := httptest.NewRecorder()

	ctrl.GetJournalDetailsHandler(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 Forbidden for unrelated user, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetJournalDetails_Unauthenticated(t *testing.T) {
	_, uc, _, ctrl := setupLedgerControllerTest()

	journalID := uuid.New()
	uc.journals[journalID] = &models.JournalEntry{
		ID: journalID,
	}

	req := httptest.NewRequest(http.MethodGet, "/ledger/journal/"+journalID.String(), nil)
	req.SetPathValue("id", journalID.String())
	w := httptest.NewRecorder()

	ctrl.GetJournalDetailsHandler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 Unauthorized, got %d", w.Code)
	}
}
