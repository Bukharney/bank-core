package controllers

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

type TransactionController struct {
	Cfg      *config.Config
	Validate *validator.Validate
	Usecase  models.TransferUsecase
}

func NewTransactionController(cfg *config.Config, usecase models.TransferUsecase) *TransactionController {
	return &TransactionController{
		Cfg:      cfg,
		Validate: validator.New(),
		Usecase:  usecase,
	}
}

// TransferHandler handles money transfers
func (c *TransactionController) TransferHandler(w http.ResponseWriter, r *http.Request) {
	transfer := &models.TransferRequest{}
	err := utils.DecodeJSON(r, transfer)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	err = c.Validate.Struct(transfer)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	userID, err := uuid.Parse(userIdStr)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	idempotencyKey := r.Header.Get("Idempotency-Key")

	receipt, err := c.Usecase.Transfer(userID, transfer, idempotencyKey)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.JSON(w, http.StatusOK, receipt)
}

// DepositHandler handles deposits
func (c *TransactionController) DepositHandler(w http.ResponseWriter, r *http.Request) {
	deposit := &models.DepositRequest{}
	err := utils.DecodeJSON(r, deposit)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	err = c.Validate.Struct(deposit)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	userID, err := uuid.Parse(userIdStr)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	idempotencyKey := r.Header.Get("Idempotency-Key")

	receipt, err := c.Usecase.Deposit(userID, deposit, idempotencyKey)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.JSON(w, http.StatusOK, receipt)
}

// WithdrawHandler handles cash withdrawals
func (c *TransactionController) WithdrawHandler(w http.ResponseWriter, r *http.Request) {
	withdraw := &models.WithdrawalRequest{}
	err := utils.DecodeJSON(r, withdraw)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	err = c.Validate.Struct(withdraw)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	userID, err := uuid.Parse(userIdStr)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	idempotencyKey := r.Header.Get("Idempotency-Key")

	receipt, err := c.Usecase.Withdrawal(userID, withdraw, idempotencyKey)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.JSON(w, http.StatusOK, receipt)
}

// RequestCardlessWithdrawalHandler handles generation of 6-digit OTP code for ATM withdrawal
func (c *TransactionController) RequestCardlessWithdrawalHandler(w http.ResponseWriter, r *http.Request) {
	req := &models.RequestCardlessWithdrawalRequest{}
	err := utils.DecodeJSON(r, req)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	userID, err := uuid.Parse(userIdStr)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	ticket, err := c.Usecase.RequestCardlessWithdrawal(userID, req)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.JSON(w, http.StatusOK, ticket)
}

// VerifyCardlessWithdrawalHandler allows ATM machine to verify phone + 6-digit code
func (c *TransactionController) VerifyCardlessWithdrawalHandler(w http.ResponseWriter, r *http.Request) {
	req := &models.VerifyCardlessWithdrawalRequest{}
	err := utils.DecodeJSON(r, req)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	res, err := c.Usecase.VerifyCardlessWithdrawal(req)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.JSON(w, http.StatusOK, res)
}

// ConfirmCardlessWithdrawalHandler allows ATM machine to confirm physical cash dispense and commit double-entry
func (c *TransactionController) ConfirmCardlessWithdrawalHandler(w http.ResponseWriter, r *http.Request) {
	req := &models.ConfirmCardlessWithdrawalRequest{}
	err := utils.DecodeJSON(r, req)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	receipt, err := c.Usecase.ConfirmCardlessWithdrawal(req)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.JSON(w, http.StatusOK, receipt)
}
