package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/responses"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

type AdminController struct {
	Cfg      *config.Config
	Validate *validator.Validate
	Usecase  models.AdminUsecase
}

func NewAdminController(cfg *config.Config, usecase models.AdminUsecase) *AdminController {
	return &AdminController{
		Cfg:      cfg,
		Validate: validator.New(),
		Usecase:  usecase,
	}
}

// GetAdminOverviewHandler returns live system balances, liquidity metrics, and ledger invariant health
func (c *AdminController) GetAdminOverviewHandler(w http.ResponseWriter, r *http.Request) {
	overview, err := c.Usecase.GetOverview()
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, overview)
}

// ListUsersHandler returns a paginated list of all users
func (c *AdminController) ListUsersHandler(w http.ResponseWriter, r *http.Request) {
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

	search := r.URL.Query().Get("q")
	if search == "" {
		search = r.URL.Query().Get("search")
	}
	role := r.URL.Query().Get("role")

	users, total, err := c.Usecase.ListUsers(search, role, limit, offset)
	if err != nil {
		responses.Error(w, http.StatusInternalServerError, err)
		return
	}

	responses.JSON(w, http.StatusOK, map[string]interface{}{
		"users":  users,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// UpdateUserRoleHandler updates a target user's role
func (c *AdminController) UpdateUserRoleHandler(w http.ResponseWriter, r *http.Request) {
	adminIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	adminID, err := uuid.Parse(adminIdStr)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	targetIdStr, err := utils.GetIDFromRequest(r, "id")
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	targetUserID, err := uuid.Parse(targetIdStr)
	if err != nil {
		responses.BadRequest(w, errors.New("invalid target user id"))
		return
	}

	req := &models.UpdateUserRoleRequest{}
	err = utils.DecodeJSON(r, req)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	err = c.Validate.Struct(req)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	err = c.Usecase.UpdateRole(adminID, targetUserID, req.Role)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	responses.JSON(w, http.StatusOK, map[string]string{
		"message": "user role updated successfully",
		"role":    req.Role,
	})
}
