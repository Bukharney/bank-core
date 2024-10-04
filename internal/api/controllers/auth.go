package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/usecases"
)

// AuthController is the controller for the auth routes
type AuthController struct {
	usecase *usecases.AuthUsecase
}

// NewAuthController creates a new AuthController
func NewAuthController(usecase *usecases.AuthUsecase) *AuthController {
	return &AuthController{
		usecase: usecase,
	}
}

// RegisterHandler handles the registration route
func (c *AuthController) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var user models.User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	err = c.usecase.Register(&user)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}
