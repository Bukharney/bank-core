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

// UpdateProfileHandler handles updating user profile info
func (c *UserController) UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	userID, err := utils.ParseUUID(userIdStr)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	req := &models.UpdateProfileRequest{}
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

	user, err := c.Usecase.UpdateProfile(userID, req)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.Success(w, user)
}

// ChangePasswordHandler handles user password changes
func (c *UserController) ChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
	userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	userID, err := utils.ParseUUID(userIdStr)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	req := &models.ChangePasswordRequest{}
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

	err = c.Usecase.ChangePassword(userID, req)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.Success(w, map[string]string{
		"message": "Password updated successfully",
	})
}

// SetPinHandler handles setting or updating the 6-digit transaction PIN
func (c *UserController) SetPinHandler(w http.ResponseWriter, r *http.Request) {
	userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	userID, err := utils.ParseUUID(userIdStr)
	if err != nil {
		responses.Unauthorized(w, err)
		return
	}

	req := &models.SetPinRequest{}
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

	err = c.Usecase.SetPin(userID, req)
	if err != nil {
		responses.Error(w, http.StatusBadRequest, err)
		return
	}

	responses.Success(w, map[string]string{
		"message": "Transaction PIN configured successfully",
	})
}


