package controllers

import (
	"net/http"
	"strconv"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
)

type LedgerController struct {
	Cfg     *config.Config
	Usecase models.LedgerUsecase
}

func NewLedgerController(cfg *config.Config, usecase models.LedgerUsecase) *LedgerController {
	return &LedgerController{
		Cfg:     cfg,
		Usecase: usecase,
	}
}

// GetAccountStatementHandler returns ledger statement / postings for an account
func (c *LedgerController) GetAccountStatementHandler(w http.ResponseWriter, r *http.Request) {
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
