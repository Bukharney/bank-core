package controllers_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bukharney/bank-core/internal/api/controllers"
	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
)

type mockAuthUsecase struct {
	loggedOutTokens []string
}

func (m *mockAuthUsecase) Login(user *models.UserCredentials) (*models.LoginResponse, error) {
	return nil, nil
}

func (m *mockAuthUsecase) Logout(refreshToken string) error {
	m.loggedOutTokens = append(m.loggedOutTokens, refreshToken)
	return nil
}

func (m *mockAuthUsecase) RefreshToken(refreshToken string) (*models.LoginResponse, error) {
	return nil, nil
}

func (m *mockAuthUsecase) Me(token string) (*models.User, error) {
	return nil, nil
}

func setupAuthControllerTest() (*config.Config, *mockAuthUsecase, *controllers.AuthController) {
	cfg := &config.Config{
		JWTSecret: map[bool]string{
			false: "test-access-secret",
			true:  "test-refresh-secret",
		},
	}
	uc := &mockAuthUsecase{}
	ctrl := controllers.NewAuthController(cfg, uc)
	return cfg, uc, ctrl
}

func TestLogoutHandler_ClearsCookiesWithoutRefreshToken(t *testing.T) {
	_, _, ctrl := setupAuthControllerTest()

	// Request with NO refresh_token cookie
	req := httptest.NewRequest(http.MethodGet, "/auth/logout", nil)
	w := httptest.NewRecorder()

	ctrl.LogoutHandler(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected status 204 No Content, got %d", w.Code)
	}

	// Verify that cookies were set with MaxAge: -1 or expiration in past
	cookies := w.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatalf("expected Set-Cookie headers to clear cookies, but none found")
	}

	foundAccess := false
	foundRefresh := false
	for _, c := range cookies {
		if c.Name == "access_token" && c.Value == "" {
			foundAccess = true
		}
		if c.Name == "refresh_token" && c.Value == "" {
			foundRefresh = true
		}
	}

	if !foundAccess || !foundRefresh {
		t.Fatalf("expected both access_token and refresh_token cookies to be cleared, found access=%v, refresh=%v", foundAccess, foundRefresh)
	}
}

func TestLogoutHandler_WithValidRefreshToken(t *testing.T) {
	_, uc, ctrl := setupAuthControllerTest()

	req := httptest.NewRequest(http.MethodGet, "/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: "refresh_token", Value: "valid-refresh-token"})
	w := httptest.NewRecorder()

	ctrl.LogoutHandler(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected status 204 No Content, got %d", w.Code)
	}

	if len(uc.loggedOutTokens) != 1 || uc.loggedOutTokens[0] != "valid-refresh-token" {
		t.Fatalf("expected usecase.Logout to be called with valid token, got %v", uc.loggedOutTokens)
	}
}
