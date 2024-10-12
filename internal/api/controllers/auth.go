package controllers

import (
	"net/http"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/go-playground/validator/v10"
)

// AuthController is the controller for the auth routes
type AuthController struct {
	Cfg      *config.Config
	Usecase  models.AuthUsecase
	Validate *validator.Validate
}

// NewAuthController creates a new AuthController
func NewAuthController(cfg *config.Config, usecase models.AuthUsecase) *AuthController {
	return &AuthController{
		Cfg:      cfg,
		Usecase:  usecase,
		Validate: validator.New(),
	}
}

// LoginHandler handles the login route
func (c *AuthController) LoginHandler(w http.ResponseWriter, r *http.Request) {
	login := &models.UserCredentials{}
	err := utils.DecodeJSON(r, login)
	if err != nil {
		responses.BadRequest(w, err)
	}

	err = c.Validate.Struct(login)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	token, err := c.Usecase.Login(login)
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

	token, err := c.Usecase.RefreshToken(refreshToken)
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

	err = c.Usecase.Logout(refreshToken)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	token := &models.LoginResponse{}

	utils.SetToken(w, token, time.Now())
	responses.NoContent(w)
}

// MeHandler handles the me route
func (c *AuthController) MeHandler(w http.ResponseWriter, r *http.Request) {
	accessToken, err := utils.ExtractToken(r, "access_token")
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	user, err := c.Usecase.Me(accessToken)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	responses.Success(w, user)

}
