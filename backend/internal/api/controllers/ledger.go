package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
)

type LedgerController struct {
	Cfg         *config.Config
	Usecase     models.LedgerUsecase
	AccountRepo models.AccountRepository
}

func NewLedgerController(cfg *config.Config, usecase models.LedgerUsecase, accountRepo models.AccountRepository) *LedgerController {
	return &LedgerController{
		Cfg:         cfg,
		Usecase:     usecase,
		AccountRepo: accountRepo,
	}
}

// GetAccountStatementHandler returns ledger statement / postings for an account
func (c *LedgerController) GetAccountStatementHandler(w http.ResponseWriter, r *http.Request) {
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

	accountIdStr, err := utils.GetIDFromRequest(r, "id")
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	accountID, err := utils.StringToInt64(accountIdStr)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	// Verify account ownership
	acc, err := c.AccountRepo.GetAccountByID(accountID)
	if err != nil || acc == nil {
		responses.NotFound(w, errors.New("account not found"))
		return
	}
	if acc.UserID != userID {
		responses.Forbidden(w, errors.New("forbidden: access to this statement is restricted to the account owner"))
		return
	}

	limit := 20
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if val, err := strconv.Atoi(l); err == nil && val > 0 {
			limit = val
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if val, err := strconv.Atoi(o); err == nil && val >= 0 {
			offset = val
		}
	}

	entries, err := c.Usecase.GetAccountStatement(accountID, limit, offset)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, entries)
}

// GetJournalDetailsHandler returns journal details by UUID
func (c *LedgerController) GetJournalDetailsHandler(w http.ResponseWriter, r *http.Request) {
	journalIdStr, err := utils.GetIDFromRequest(r, "id")
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	journalID, err := uuid.Parse(journalIdStr)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	journal, err := c.Usecase.GetJournalDetails(journalID)
	if err != nil {
		responses.Error(w, http.StatusNotFound, err)
		return
	}

	responses.JSON(w, http.StatusOK, journal)
}
