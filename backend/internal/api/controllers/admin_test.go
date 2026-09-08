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

type mockUserUsecaseForAdmin struct {
	users map[uuid.UUID]*models.User
}

func (m *mockUserUsecaseForAdmin) Register(req *models.RegisterRequest) (*models.User, error) {
	return nil, nil
}

func (m *mockUserUsecaseForAdmin) GetProfile(userID uuid.UUID) (*models.User, error) {
	if u, ok := m.users[userID]; ok {
		return u, nil
	}
	return nil, errors.New("user not found")
}

func (m *mockUserUsecaseForAdmin) UpdateProfile(userID uuid.UUID, req *models.UpdateProfileRequest) (*models.User, error) {
	return nil, nil
}

func (m *mockUserUsecaseForAdmin) ChangePassword(userID uuid.UUID, req *models.ChangePasswordRequest) error {
	return nil
}

func (m *mockUserUsecaseForAdmin) SetPin(userID uuid.UUID, req *models.SetPinRequest) error {
	return nil
}

func (m *mockUserUsecaseForAdmin) VerifyPin(userID uuid.UUID, pin string) error {
	return nil
}

func (m *mockUserUsecaseForAdmin) UpdateRole(adminID, targetUserID uuid.UUID, role string) error {
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

func (m *mockUserUsecaseForAdmin) ListUsers(limit, offset int) ([]models.User, int, error) {
	res := []models.User{}
	for _, u := range m.users {
		res = append(res, *u)
	}
	return res, len(res), nil
}

func setupAdminControllerTest() (*config.Config, *mockUserUsecaseForAdmin, *controllers.AdminController) {
	cfg := &config.Config{
		JWTSecret: map[bool]string{
			false: "test-access-secret",
			true:  "test-refresh-secret",
		},
	}
	uc := &mockUserUsecaseForAdmin{
		users: make(map[uuid.UUID]*models.User),
	}
	ctrl := controllers.NewAdminController(cfg, uc)
	return cfg, uc, ctrl
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
