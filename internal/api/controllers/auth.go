package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/go-playground/validator/v10"
)

// AuthController is the controller for the auth routes
type AuthController struct {
	usecase  *usecases.AuthUsecase
	validate *validator.Validate
}

// NewAuthController creates a new AuthController
func NewAuthController(usecase *usecases.AuthUsecase) *AuthController {
	return &AuthController{
		usecase:  usecase,
		validate: validator.New(),
	}
}

// RegisterHandler handles the registration route
func (c *AuthController) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var user models.User
	// Bind the request body to the user struct
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("Invalid request body"))
		return
	}

	// Validate struct
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
	var credentials models.UserCredentials
	// Bind the request body to the credentials struct
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

	json.NewEncoder(w).Encode(token)
}
