package controllers

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/go-playground/validator/v10"
)

// UserController is the controller for the user routes
type UserController struct {
	Cfg      *config.Config
	Validate *validator.Validate
	Usecase  *usecases.UserUsecase
}

// NewUserController creates a new UserController
func NewUserController(cfg *config.Config, usecase *usecases.UserUsecase) *UserController {
	return &UserController{
		Cfg:      cfg,
		Validate: validator.New(),
		Usecase:  usecase,
	}
}

// RegisterHandler handles the registration route
func (c *UserController) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	user := &models.User{}
	err := utils.DecodeJSON(r, user)
	if err != nil {
		responses.BadRequest(w, err)
	}

	err = c.Validate.Struct(user)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	status, err := c.Usecase.Register(user)
	if err != nil {
		responses.Error(w, status, err)
		return
	}

	responses.Success(w, nil)
}
