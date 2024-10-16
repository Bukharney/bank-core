package controllers

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/go-playground/validator/v10"
)

// AccountController is the controller for the account routes
type AccountController struct {
	Cfg      *config.Config
	Validate *validator.Validate
	Usecase  models.AccountUsecase
}

// NewAccountController creates a new AccountController
func NewAccountController(cfg *config.Config, usecase models.AccountUsecase) *AccountController {
	return &AccountController{
		Cfg:      cfg,
		Validate: validator.New(),
		Usecase:  usecase,
	}
}

// CreateAccountHandler handles the create account route
func (c *AccountController) CreateAccountHandler(w http.ResponseWriter, r *http.Request) {
	userId, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	err = c.Usecase.CreateAccount(userId)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusCreated, nil)
}

// GetAccountHandler handles the get account route
func (c *AccountController) GetAccountHandler(w http.ResponseWriter, r *http.Request) {
	userId, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	account, err := c.Usecase.GetAccountsByUserID(userId)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, account)
}

// GetAccountByIDHandler handles the get account by ID route
func (c *AccountController) GetAccountByIDHandler(w http.ResponseWriter, r *http.Request) {
	accountId, err := utils.GetIDFromRequest(r, "id")
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	account, err := c.Usecase.GetAccountByID(accountId)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, account)
}
