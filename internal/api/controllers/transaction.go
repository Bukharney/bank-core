package controllers

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/go-playground/validator/v10"
)

// TransactionController is the controller for the transaction routes
type TransactionController struct {
	Cfg      *config.Config
	Validate *validator.Validate
	Usecase  models.TransactionUsecase
}

// NewTransactionController creates a new TransactionController
func NewTransactionController(cfg *config.Config, usecase models.TransactionUsecase) *TransactionController {
	return &TransactionController{
		Cfg:      cfg,
		Validate: validator.New(),
		Usecase:  usecase,
	}
}

// TransferHandler handles the transfer route
func (c *TransactionController) TransferHandler(w http.ResponseWriter, r *http.Request) {
	transfer := &models.TransferRequest{}
	err := utils.DecodeJSON(r, transfer)
	if err != nil {
		responses.BadRequest(w, err)
	}

	err = c.Validate.Struct(transfer)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	userId, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	transfer.UserID = userId

	err = c.Usecase.Transfer(transfer)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, nil)
}

// DepositHandler handles the deposit route
func (c *TransactionController) DepositHandler(w http.ResponseWriter, r *http.Request) {
	deposit := &models.DepositRequest{}
	err := utils.DecodeJSON(r, deposit)
	if err != nil {
		responses.BadRequest(w, err)
	}

	err = c.Validate.Struct(deposit)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	userId, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	deposit.UserID = userId

	err = c.Usecase.Deposit(deposit)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, nil)
}

// WithdrawHandler handles the withdraw route
func (c *TransactionController) WithdrawHandler(w http.ResponseWriter, r *http.Request) {
	withdraw := &models.WithdrawalRequest{}
	err := utils.DecodeJSON(r, withdraw)
	if err != nil {
		responses.BadRequest(w, err)
	}

	err = c.Validate.Struct(withdraw)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	userId, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	withdraw.UserID = userId

	err = c.Usecase.Withdrawal(withdraw)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, nil)
}

// UpdateTransactionHandler handles the update transaction route
func (c *TransactionController) UpdateTransactionStatusHandler(w http.ResponseWriter, r *http.Request) {
	update := &models.UpdateTransactionStatusRequest{}
	err := utils.DecodeJSON(r, update)
	if err != nil {
		responses.BadRequest(w, err)
	}

	err = c.Validate.Struct(update)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	userId, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	update.UserID = userId

	err = c.Usecase.UpdateTransactionStatus(update)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, nil)
}
