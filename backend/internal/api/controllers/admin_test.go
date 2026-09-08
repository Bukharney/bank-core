package controllers_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bukharney/bank-core/internal/api/controllers"
	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
)

type mockAdminUsecase struct {
	users    map[uuid.UUID]*models.User
	overview *models.AdminOverviewResponse
}

func (m *mockAdminUsecase) GetOverview() (*models.AdminOverviewResponse, error) {
	if m.overview != nil {
		return m.overview, nil
	}
	return &models.AdminOverviewResponse{
		SystemAccounts: []models.SystemAccountOverview{
			{
				ID:            100,
				AccountNumber: "SYS-CASH-SETTLE",
				Label:         "Central Clearing & Settlement",
				Category:      "CENTRAL_SETTLEMENT",
				BalanceSatang: 10000000000,
				Currency:      "THB",
				Status:        "ACTIVE",
			},
		},
		TotalSystemLiquidity:  10000000000,
		TotalCustomerDeposits: 50000000,
		ActiveAccountsCount:   10,
		TotalUsersCount:       5,
		Transactions24hCount:  25,
		Transactions24hVolume: 2500000,
		LedgerHealth: models.LedgerHealthStatus{
			InvariantOK:         true,
			TotalDebits:         5000000,
			TotalCredits:        5000000,
			LeakageSatang:       0,
			PendingOutboxEvents: 0,
		},
	}, nil
}

func (m *mockAdminUsecase) Register(req *models.RegisterRequest) (*models.User, error) {
	return nil, nil
}

func (m *mockAdminUsecase) GetProfile(userID uuid.UUID) (*models.User, error) {
	if u, ok := m.users[userID]; ok {
		return u, nil
	}
	return nil, errors.New("user not found")
}

func (m *mockAdminUsecase) UpdateProfile(userID uuid.UUID, req *models.UpdateProfileRequest) (*models.User, error) {
	return nil, nil
}

func (m *mockAdminUsecase) ChangePassword(userID uuid.UUID, req *models.ChangePasswordRequest) error {
	return nil
}

func (m *mockAdminUsecase) SetPin(userID uuid.UUID, req *models.SetPinRequest) error {
	return nil
}

func (m *mockAdminUsecase) VerifyPin(userID uuid.UUID, pin string) error {
	return nil
}

func (m *mockAdminUsecase) UpdateRole(adminID, targetUserID uuid.UUID, role string) error {
	switch role {
	case models.UserRoleUser, models.UserRoleAuditor, models.UserRoleTeller, models.UserRoleAdmin:
	default:
		return errors.New("invalid role")
	}

	if adminID == targetUserID && role != models.UserRoleAdmin {
		return errors.New("cannot demote yourself from admin role")
	}

	if u, ok := m.users[targetUserID]; ok {
		u.Role = role
		return nil
	}
	return errors.New("user not found")
}

func (m *mockAdminUsecase) ListUsers(search string, role string, limit, offset int) ([]models.User, int, error) {
	res := []models.User{}
	for _, u := range m.users {
		if role != "" && role != "all" && u.Role != role {
			continue
		}
		res = append(res, *u)
	}
	return res, len(res), nil
}

func setupAdminControllerTest() (*config.Config, *mockAdminUsecase, *controllers.AdminController) {
	cfg := &config.Config{
		JWTSecret: map[bool]string{
			false: "test-access-secret",
			true:  "test-refresh-secret",
		},
	}
	uc := &mockAdminUsecase{
		users: make(map[uuid.UUID]*models.User),
	}
	ctrl := controllers.NewAdminController(cfg, uc)
	return cfg, uc, ctrl
}

func TestAdminController_GetAdminOverview(t *testing.T) {
	cfg, _, ctrl := setupAdminControllerTest()

	adminID := uuid.New()
	adminToken, err := utils.GenerateToken(cfg, adminID, models.UserRoleAdmin, false)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/overview", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: adminToken})
	w := httptest.NewRecorder()

	ctrl.GetAdminOverviewHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var resp models.AdminOverviewResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.TotalSystemLiquidity != 10000000000 {
		t.Errorf("expected liquidity 10000000000, got %d", resp.TotalSystemLiquidity)
	}
	if !resp.LedgerHealth.InvariantOK {
		t.Errorf("expected InvariantOK to be true")
	}
}

func TestAdminController_ListUsers(t *testing.T) {
	cfg, uc, ctrl := setupAdminControllerTest()

	adminID := uuid.New()
	adminToken, err := utils.GenerateToken(cfg, adminID, models.UserRoleAdmin, false)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	u1 := &models.User{ID: adminID, Username: "admin", Role: models.UserRoleAdmin}
	u2 := &models.User{ID: uuid.New(), Username: "alice", Role: models.UserRoleUser}
	uc.users[adminID] = u1
	uc.users[u2.ID] = u2

	req := httptest.NewRequest(http.MethodGet, "/admin/users?limit=10&offset=0", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: adminToken})
	w := httptest.NewRecorder()

	ctrl.ListUsersHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Users []models.User `json:"users"`
		Total int           `json:"total"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Total != 2 {
		t.Errorf("expected total 2, got %d", resp.Total)
	}
}

func TestAdminController_ListUsers_FilterRole(t *testing.T) {
	cfg, uc, ctrl := setupAdminControllerTest()

	adminID := uuid.New()
	adminToken, _ := utils.GenerateToken(cfg, adminID, models.UserRoleAdmin, false)

	u1 := &models.User{ID: adminID, Username: "admin", Role: models.UserRoleAdmin}
	u2 := &models.User{ID: uuid.New(), Username: "alice", Role: models.UserRoleUser}
	u3 := &models.User{ID: uuid.New(), Username: "bob", Role: models.UserRoleTeller}
	uc.users[adminID] = u1
	uc.users[u2.ID] = u2
	uc.users[u3.ID] = u3

	req := httptest.NewRequest(http.MethodGet, "/admin/users?role=teller", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: adminToken})
	w := httptest.NewRecorder()

	ctrl.ListUsersHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Users []models.User `json:"users"`
		Total int           `json:"total"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Total != 1 {
		t.Errorf("expected total 1, got %d", resp.Total)
	}
	if len(resp.Users) != 1 || resp.Users[0].Role != models.UserRoleTeller {
		t.Errorf("expected 1 teller user, got %+v", resp.Users)
	}
}

func TestAdminController_UpdateUserRole_Success(t *testing.T) {
	cfg, uc, ctrl := setupAdminControllerTest()

	adminID := uuid.New()
	adminToken, _ := utils.GenerateToken(cfg, adminID, models.UserRoleAdmin, false)

	targetID := uuid.New()
	uc.users[targetID] = &models.User{ID: targetID, Username: "target", Role: models.UserRoleUser}

	body, _ := json.Marshal(models.UpdateUserRoleRequest{Role: models.UserRoleAuditor})
	req := httptest.NewRequest(http.MethodPatch, "/admin/users/"+targetID.String()+"/role", bytes.NewReader(body))
	req.SetPathValue("id", targetID.String())
	req.AddCookie(&http.Cookie{Name: "access_token", Value: adminToken})
	w := httptest.NewRecorder()

	ctrl.UpdateUserRoleHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	if uc.users[targetID].Role != models.UserRoleAuditor {
		t.Errorf("expected updated role 'auditor', got %s", uc.users[targetID].Role)
	}
}

func TestAdminController_UpdateUserRole_PreventSelfDemotion(t *testing.T) {
	cfg, uc, ctrl := setupAdminControllerTest()

	adminID := uuid.New()
	adminToken, _ := utils.GenerateToken(cfg, adminID, models.UserRoleAdmin, false)
	uc.users[adminID] = &models.User{ID: adminID, Username: "superadmin", Role: models.UserRoleAdmin}

	body, _ := json.Marshal(models.UpdateUserRoleRequest{Role: models.UserRoleUser})
	req := httptest.NewRequest(http.MethodPatch, "/admin/users/"+adminID.String()+"/role", bytes.NewReader(body))
	req.SetPathValue("id", adminID.String())
	req.AddCookie(&http.Cookie{Name: "access_token", Value: adminToken})
	w := httptest.NewRecorder()

	ctrl.UpdateUserRoleHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 Bad Request on self-demotion, got %d", w.Code)
	}
}
