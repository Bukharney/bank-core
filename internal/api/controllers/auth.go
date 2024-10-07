package controllers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/go-playground/validator/v10"
)

// AuthController is the controller for the auth routes
type AuthController struct {
	cfg      *config.Config
	usecase  *usecases.AuthUsecase
	validate *validator.Validate
}

// NewAuthController creates a new AuthController
func NewAuthController(cfg *config.Config, usecase *usecases.AuthUsecase) *AuthController {
	return &AuthController{
		cfg:      cfg,
		usecase:  usecase,
		validate: validator.New(),
	}
}

// RegisterHandler handles the registration route
func (c *AuthController) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	user := models.User{}
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("Invalid request body"))
		return
	}

	err = c.validate.Struct(user)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(err.Error()))
		return
	}

	code, err := c.usecase.Register(&user)
	if err != nil {
		w.WriteHeader(code)
		w.Write([]byte(err.Error()))
		return
	}

	w.WriteHeader(code)
}

// LoginHandler handles the login route
func (c *AuthController) LoginHandler(w http.ResponseWriter, r *http.Request) {
	credentials := models.UserCredentials{}
	err := json.NewDecoder(r.Body).Decode(&credentials)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("Invalid request body"))
		return
	}

	token, err := c.usecase.Login(&credentials)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(err.Error()))
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    token.Token,
		HttpOnly: true,
		Secure:   true,
		Expires:  time.Now().Add(24 * time.Hour),
		SameSite: http.SameSiteStrictMode,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    token.RefreshToken,
		Secure:   true,
		Expires:  time.Now().Add(24 * time.Hour),
		SameSite: http.SameSiteStrictMode,
	})

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(token)
}

// RefreshTokenHandler handles the refresh token route
func (c *AuthController) RefreshTokenHandler(w http.ResponseWriter, r *http.Request) {

}

// LogoutHandler handles the logout route
func (c *AuthController) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	// Get the refresh token from the request body
	// Check if the refresh token is valid
	// If the refresh token is valid, delete the refresh token from the database
	// If the refresh token is invalid, return a 401 Unauthorized response
}

// MeHandler handles the me route
func (c *AuthController) MeHandler(w http.ResponseWriter, r *http.Request) {
	refreshToken := utils.ExtractToken(r, "refresh_token")
	if refreshToken == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	accessToken := utils.ExtractToken(r, "access_token")
	if accessToken == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	json.NewEncoder(w).Encode(models.LoginResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
	})
}
