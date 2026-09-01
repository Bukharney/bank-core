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
	return u.Repo.GetUserByID(userID)
}
