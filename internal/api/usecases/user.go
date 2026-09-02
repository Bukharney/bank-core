package usecases

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserUsecase struct {
	Cfg         *config.Config
	Repo        models.UserRepository
	AccountRepo models.AccountRepository
}

func NewUserUsecase(cfg *config.Config, repo models.UserRepository, accountRepo models.AccountRepository) models.UserUsecase {
	return &UserUsecase{
		Repo:        repo,
		AccountRepo: accountRepo,
		Cfg:         cfg,
	}
}

func (u *UserUsecase) Register(req *models.RegisterRequest) (*models.User, error) {
	_, err := u.Repo.GetUserByEmail(req.Email)
	if err == nil {
		return nil, fmt.Errorf("user with email %s already exists", req.Email)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	var phonePtr *string
	if req.PhoneNumber != "" {
		phonePtr = &req.PhoneNumber
	} else {
		// Generate standard demo Thai mobile phone 08XXXXXXXX
		randPhone := fmt.Sprintf("08%08d", rand.Int63n(100000000))
		phonePtr = &randPhone
	}

	userID := uuid.New()
	user := &models.User{
		ID:           userID,
		Username:     req.Username,
		Email:        req.Email,
		PhoneNumber:  phonePtr,
		PasswordHash: string(hashedPassword),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Role:         models.UserRoleUser,
		Status:       models.UserStatusActive,
	}

	err = u.Repo.CreateUser(user)
	if err != nil {
		return nil, err
	}

	// Create initial savings account for user
	randGen := rand.New(rand.NewSource(time.Now().UnixNano()))
	accNumber := fmt.Sprintf("%010d", randGen.Int63n(10000000000))

	initialAccount := &models.Account{
		AccountNumber: accNumber,
		UserID:        userID,
		Currency:      "THB",
		AccountType:   models.AccountTypeSavings,
		Status:        models.AccountStatusActive,
		Balance:       0,
		Version:       1,
	}
	_ = u.AccountRepo.CreateAccount(nil, initialAccount)

	return user, nil
}

func (u *UserUsecase) GetProfile(userID uuid.UUID) (*models.User, error) {
	user, err := u.Repo.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	user.HasPin = (user.PinHash != nil && *user.PinHash != "")
	return user, nil
}

func (u *UserUsecase) UpdateProfile(userID uuid.UUID, req *models.UpdateProfileRequest) (*models.User, error) {
	if req.FirstName == "" {
		return nil, fmt.Errorf("first name is required")
	}
	if req.LastName == "" {
		return nil, fmt.Errorf("last name is required")
	}

	var phonePtr *string
	if req.PhoneNumber != nil && *req.PhoneNumber != "" {
		phone := *req.PhoneNumber
		// Check if another user already has this phone number
		existingUser, err := u.Repo.GetUserByPhone(phone)
		if err == nil && existingUser != nil && existingUser.ID != userID {
			return nil, fmt.Errorf("phone number %s is already registered to another account", phone)
		}
		phonePtr = &phone
	}

	err := u.Repo.UpdateProfile(userID, req.FirstName, req.LastName, phonePtr)
	if err != nil {
		return nil, err
	}

	updatedUser, err := u.Repo.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	updatedUser.HasPin = (updatedUser.PinHash != nil && *updatedUser.PinHash != "")
	return updatedUser, nil
}

func (u *UserUsecase) ChangePassword(userID uuid.UUID, req *models.ChangePasswordRequest) error {
	if req.OldPassword == "" {
		return fmt.Errorf("current password is required")
	}
	if len(req.NewPassword) < 8 {
		return fmt.Errorf("new password must be at least 8 characters")
	}
	if req.NewPassword != req.ConfirmPassword {
		return fmt.Errorf("new password and confirmation do not match")
	}

	user, err := u.Repo.GetUserByID(userID)
	if err != nil {
		return err
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword))
	if err != nil {
		return fmt.Errorf("incorrect current password")
	}

	newHashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return u.Repo.UpdatePassword(userID, string(newHashedPassword))
}

func (u *UserUsecase) SetPin(userID uuid.UUID, req *models.SetPinRequest) error {
	if req.Password == "" {
		return fmt.Errorf("account password is required")
	}
	if len(req.PIN) != 6 || !isNumeric(req.PIN) {
		return fmt.Errorf("PIN must be exactly 6 numeric digits")
	}
	if req.PIN != req.ConfirmPIN {
		return fmt.Errorf("PIN and confirmation do not match")
	}

	user, err := u.Repo.GetUserByID(userID)
	if err != nil {
		return err
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return fmt.Errorf("incorrect account password")
	}

	pinHash, err := bcrypt.GenerateFromPassword([]byte(req.PIN), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return u.Repo.SetPin(userID, string(pinHash))
}

func (u *UserUsecase) VerifyPin(userID uuid.UUID, pin string) error {
	if len(pin) != 6 || !isNumeric(pin) {
		return fmt.Errorf("invalid PIN format: must be 6 digits")
	}

	user, err := u.Repo.GetUserByID(userID)
	if err != nil {
		return err
	}

	if user.PinHash == nil || *user.PinHash == "" {
		return fmt.Errorf("security PIN is not configured. Please set up a 6-digit PIN in Settings")
	}

	if user.PinFailedAttempts >= 5 {
		return fmt.Errorf("PIN is locked due to too many failed attempts (5/5). Please reset your PIN in Settings using your password")
	}

	err = bcrypt.CompareHashAndPassword([]byte(*user.PinHash), []byte(pin))
	if err != nil {
		attempts, incErr := u.Repo.IncrementPinFailedAttempts(userID)
		if incErr != nil {
			return incErr
		}
		remaining := 5 - attempts
		if remaining <= 0 {
			return fmt.Errorf("incorrect PIN. Your PIN is now locked (5/5 attempts). Please reset your PIN in Settings")
		}
		return fmt.Errorf("incorrect PIN. %d attempt(s) remaining", remaining)
	}

	_ = u.Repo.ResetPinFailedAttempts(userID)
	return nil
}

func isNumeric(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}


