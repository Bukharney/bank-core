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
)

type mockAccountUsecase struct {
	accountsByID     map[int64]*models.Account
	accountsByNumber map[string]*models.Account
}

func (m *mockAccountUsecase) CreateAccount(req *models.CreateAccountRequest) (*models.Account, error) {
	return nil, nil
}

func (m *mockAccountUsecase) GetAccountByID(accountID int64) (*models.Account, error) {
	if acc, ok := m.accountsByID[accountID]; ok {
		return acc, nil
	}
	return nil, errors.New("not found")
}

func (m *mockAccountUsecase) GetAccountByNumber(accountNumber string) (*models.Account, error) {
	if acc, ok := m.accountsByNumber[accountNumber]; ok {
		return acc, nil
	}
	return nil, errors.New("not found")
}

func (m *mockAccountUsecase) GetAccountsByUserID(userID uuid.UUID) ([]*models.Account, error) {
	var list []*models.Account
	for _, a := range m.accountsByID {
		if a.UserID == userID {
			list = append(list, a)
		}
	}
	return list, nil
}

func (m *mockAccountUsecase) UpdateAccountStatus(req *models.UpdateAccountStatusRequest) error {
	return nil
}

func setupAccountControllerTest() (*config.Config, *mockAccountUsecase, *controllers.AccountController) {
	cfg := &config.Config{
		JWTSecret: map[bool]string{
			false: "test-access-secret",
			true:  "test-refresh-secret",
		},
	}
	uc := &mockAccountUsecase{
		accountsByID:     make(map[int64]*models.Account),
		accountsByNumber: make(map[string]*models.Account),
	}
	ctrl := controllers.NewAccountController(cfg, uc)
	return cfg, uc, ctrl
}

func TestGetAccountPreviewHandler_Success(t *testing.T) {
	_, uc, ctrl := setupAccountControllerTest()

	ownerID := uuid.New()
	targetAccount := &models.Account{
		ID:                10,
		AccountNumber:     "1234567890",
		UserID:            ownerID,
		AccountHolderName: "Jane Doe",
		Currency:          "THB",
		AccountType:       models.AccountTypeSavings,
		Status:            models.AccountStatusActive,
		Balance:           99999900, // 999,999.00 THB
		CreatedAt:         time.Now(),
	}
	uc.accountsByID[10] = targetAccount
	uc.accountsByNumber["1234567890"] = targetAccount

	// Anyone can query preview endpoint
	req := httptest.NewRequest(http.MethodGet, "/account/preview/1234567890", nil)
	req.SetPathValue("id", "1234567890")
	w := httptest.NewRecorder()

	ctrl.GetAccountPreviewHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["account_number"] != "1234567890" {
		t.Errorf("expected account_number 1234567890, got %v", resp["account_number"])
	}
	if resp["account_holder_name"] != "Jane Doe" {
		t.Errorf("expected account_holder_name Jane Doe, got %v", resp["account_holder_name"])
	}
	// Crucial: balance must NOT be present in preview response!
	if _, hasBalance := resp["balance"]; hasBalance {
		t.Errorf("expected preview response NOT to contain balance, but it was present: %v", resp["balance"])
	}
}

func TestGetAccountByIDHandler_OwnerAccess(t *testing.T) {
	cfg, uc, ctrl := setupAccountControllerTest()

	ownerID := uuid.New()
	token, err := utils.GenerateToken(cfg, ownerID, false)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	account := &models.Account{
		ID:                10,
		AccountNumber:     "1234567890",
		UserID:            ownerID,
		AccountHolderName: "Jane Doe",
		Currency:          "THB",
		AccountType:       models.AccountTypeSavings,
		Status:            models.AccountStatusActive,
		Balance:           50000,
	}
	uc.accountsByID[10] = account
	uc.accountsByNumber["1234567890"] = account

	req := httptest.NewRequest(http.MethodGet, "/account/10", nil)
	req.SetPathValue("id", "10")
	req.AddCookie(&http.Cookie{Name: "access_token", Value: token})
	w := httptest.NewRecorder()

	ctrl.GetAccountByIDHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 for owner, got %d: %s", w.Code, w.Body.String())
	}

	var resp models.Account
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode account response: %v", err)
	}
	if resp.Balance != 50000 {
		t.Errorf("expected balance 50000, got %d", resp.Balance)
	}
}

func TestGetAccountByIDHandler_ForeignAccountForbidden(t *testing.T) {
	cfg, uc, ctrl := setupAccountControllerTest()

	ownerID := uuid.New()
	callerID := uuid.New()

	callerToken, err := utils.GenerateToken(cfg, callerID, false)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	account := &models.Account{
		ID:                10,
		AccountNumber:     "1234567890",
		UserID:            ownerID,
		AccountHolderName: "Jane Doe",
		Currency:          "THB",
		AccountType:       models.AccountTypeSavings,
		Status:            models.AccountStatusActive,
		Balance:           50000,
	}
	uc.accountsByID[10] = account
	uc.accountsByNumber["1234567890"] = account

	// Caller attempts to access Jane Doe's account details
	req := httptest.NewRequest(http.MethodGet, "/account/10", nil)
	req.SetPathValue("id", "10")
	req.AddCookie(&http.Cookie{Name: "access_token", Value: callerToken})
	w := httptest.NewRecorder()

	ctrl.GetAccountByIDHandler(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 Forbidden for foreign account, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetAccountByIDHandler_Unauthenticated(t *testing.T) {
	_, uc, ctrl := setupAccountControllerTest()

	account := &models.Account{
		ID:            10,
		AccountNumber: "1234567890",
		UserID:        uuid.New(),
	}
	uc.accountsByID[10] = account

	req := httptest.NewRequest(http.MethodGet, "/account/10", nil)
	w := httptest.NewRecorder()

	ctrl.GetAccountByIDHandler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 Unauthorized without token cookie, got %d", w.Code)
	}
}
