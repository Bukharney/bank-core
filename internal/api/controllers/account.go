package controllers

import (
	"errors"
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

type AccountController struct {
	Cfg      *config.Config
	Validate *validator.Validate
	Usecase  models.AccountUsecase
}

func NewAccountController(cfg *config.Config, usecase models.AccountUsecase) *AccountController {
	return &AccountController{
		Cfg:      cfg,
		Validate: validator.New(),
		Usecase:  usecase,
	}
}

// CreateAccountHandler handles the create account route
func (c *AccountController) CreateAccountHandler(w http.ResponseWriter, r *http.Request) {
	userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	userID, err := uuid.Parse(userIdStr)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	req := &models.CreateAccountRequest{}
	if err := utils.DecodeJSON(r, req); err != nil {
		// If body is empty, set defaults
		req.AccountType = models.AccountTypeSavings
		req.Currency = "THB"
	}
	req.UserID = userID

	if err := c.Validate.Struct(req); err != nil {
		responses.BadRequest(w, err)
		return
	}

	account, err := c.Usecase.CreateAccount(req)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusCreated, account)
}

// GetAccountHandler gets all accounts belonging to the current user
func (c *AccountController) GetAccountHandler(w http.ResponseWriter, r *http.Request) {
	userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	userID, err := uuid.Parse(userIdStr)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	accounts, err := c.Usecase.GetAccountsByUserID(userID)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, accounts)
}

// GetAccountByIDHandler handles the get account by ID or Account Number route
func (c *AccountController) GetAccountByIDHandler(w http.ResponseWriter, r *http.Request) {
	queryParam, err := utils.GetIDFromRequest(r, "id")
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	// Clean any hyphens or spaces
	cleanParam := ""
	for _, ch := range queryParam {
		if ch >= '0' && ch <= '9' {
			cleanParam += string(ch)
		}
	}

	if cleanParam == "" {
		responses.BadRequest(w, errors.New("invalid account parameter"))
		return
	}

	// Try lookup by numeric ID first if value is small
	accountID, err := utils.StringToInt64(cleanParam)
	if err == nil && len(cleanParam) < 9 {
		account, err := c.Usecase.GetAccountByID(accountID)
		if err == nil && account != nil {
			responses.JSON(w, http.StatusOK, account)
			return
		}
	}

	// Try lookup by 10-digit account number
	account, err := c.Usecase.GetAccountByNumber(cleanParam)
	if err == nil && account != nil {
		responses.JSON(w, http.StatusOK, account)
		return
	}

	// If not found yet and accountID parsed, try ID once more
	if accountID > 0 {
		account, err = c.Usecase.GetAccountByID(accountID)
		if err == nil && account != nil {
			responses.JSON(w, http.StatusOK, account)
			return
		}
	}

	responses.NotFound(w, errors.New("account not found"))
}
