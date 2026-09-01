package controllers

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/go-playground/validator/v10"
)

type UserController struct {
	Cfg      *config.Config
	Validate *validator.Validate
	Usecase  models.UserUsecase
}

func NewUserController(cfg *config.Config, usecase models.UserUsecase) *UserController {
	return &UserController{
		Cfg:      cfg,
		Validate: validator.New(),
		Usecase:  usecase,
	}
}

// RegisterHandler handles user registration
func (c *UserController) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	req := &models.RegisterRequest{}
	err := utils.DecodeJSON(r, req)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	err = c.Validate.Struct(req)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	user, err := c.Usecase.Register(req)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.JSON(w, http.StatusCreated, user)
}
