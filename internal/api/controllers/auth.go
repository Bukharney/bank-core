package controllers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
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
		responses.BadRequest(w, err)
		return
	}

	err = c.validate.Struct(user)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	code, err := c.usecase.Register(&user)
	if err != nil {
		responses.Error(w, code, err)
		return
	}

	responses.Created(w, nil)
}

// LoginHandler handles the login route
func (c *AuthController) LoginHandler(w http.ResponseWriter, r *http.Request) {
	credentials := models.UserCredentials{}
	err := json.NewDecoder(r.Body).Decode(&credentials)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	token, err := c.usecase.Login(&credentials)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	utils.SetToken(w, token, time.Now().Add(24*time.Hour))
	responses.Success(w, token)
}

// RefreshTokenHandler handles the refresh token route
func (c *AuthController) RefreshTokenHandler(w http.ResponseWriter, r *http.Request) {
	refreshToken, err := utils.ExtractToken(r, "refresh_token")
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	token, err := c.usecase.RefreshToken(refreshToken)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	utils.SetToken(w, token, time.Now().Add(24*time.Hour))
	responses.Success(w, token)

}

// LogoutHandler handles the logout route
func (c *AuthController) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	refreshToken, err := utils.ExtractToken(r, "refresh_token")
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	err = c.usecase.Logout(refreshToken)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	utils.SetToken(w, &models.LoginResponse{}, time.Now().Add(-24*time.Hour))

	responses.NoContent(w)
}

// MeHandler handles the me route
func (c *AuthController) MeHandler(w http.ResponseWriter, r *http.Request) {
	// refreshToken := utils.ExtractToken(r, "refresh_token")
	// if refreshToken == "" {
	// 	w.WriteHeader(http.StatusUnauthorized)
	// 	return
	// }

	// accessToken := utils.ExtractToken(r, "access_token")
	// if accessToken == "" {
	// 	w.WriteHeader(http.StatusUnauthorized)
	// 	return
	// }

	// json.NewEncoder(w).Encode(models.LoginResponse{
	// 	AccessToken:  accessToken,
	// 	RefreshToken: refreshToken,
	// })
}
