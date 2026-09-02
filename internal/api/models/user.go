package models

import (
	"time"

	"github.com/google/uuid"
)

// User Status Constants
const (
	UserStatusActive    = "ACTIVE"
	UserStatusSuspended = "SUSPENDED"
	UserStatusClosed    = "CLOSED"
)

// User Role Constants
const (
	UserRoleUser  = "user"
	UserRoleAdmin = "admin"
)

type User struct {
	ID                uuid.UUID `json:"id" db:"id"`
	Username          string    `json:"username" db:"username" validate:"required,min=3,max=50"`
	Email             string    `json:"email" db:"email" validate:"required,email"`
	PhoneNumber       *string   `json:"phone_number" db:"phone_number"`
	PasswordHash      string    `json:"-" db:"password_hash"`
	PinHash           *string   `json:"-" db:"pin_hash"`
	HasPin            bool      `json:"has_pin" db:"-"`
	PinFailedAttempts int       `json:"pin_failed_attempts" db:"pin_failed_attempts"`
	FirstName         string    `json:"first_name" db:"first_name" validate:"required"`
	LastName          string    `json:"last_name" db:"last_name" validate:"required"`
	Role              string    `json:"role" db:"role"`
	Status            string    `json:"status" db:"status"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

type RegisterRequest struct {
	Username    string `json:"username" validate:"required,min=3,max=50"`
	Email       string `json:"email" validate:"required,email"`
	PhoneNumber string `json:"phone_number"`
	Password    string `json:"password" validate:"required,min=8"`
	FirstName   string `json:"first_name" validate:"required"`
	LastName    string `json:"last_name" validate:"required"`
}

type UpdateProfileRequest struct {
	FirstName   string  `json:"first_name" validate:"required"`
	LastName    string  `json:"last_name" validate:"required"`
	PhoneNumber *string `json:"phone_number"`
}

type ChangePasswordRequest struct {
	OldPassword     string `json:"old_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
	ConfirmPassword string `json:"confirm_password" validate:"required,min=8"`
}

type SetPinRequest struct {
	Password   string `json:"password" validate:"required"`
	PIN        string `json:"pin" validate:"required,len=6,numeric"`
	ConfirmPIN string `json:"confirm_pin" validate:"required,len=6,numeric"`
}

type VerifyPinRequest struct {
	PIN string `json:"pin" validate:"required,len=6,numeric"`
}

type UserRepository interface {
	GetUserByEmail(email string) (*User, error)
	GetUserByID(id uuid.UUID) (*User, error)
	GetUserByUsername(username string) (*User, error)
	GetUserByPhone(phone string) (*User, error)
	CreateUser(user *User) error
	UpdateUserStatus(id uuid.UUID, status string) error
	UpdateProfile(id uuid.UUID, firstName, lastName string, phoneNumber *string) error
	UpdatePassword(id uuid.UUID, passwordHash string) error
	SetPin(id uuid.UUID, pinHash string) error
	ResetPinFailedAttempts(id uuid.UUID) error
	IncrementPinFailedAttempts(id uuid.UUID) (int, error)
}

type UserUsecase interface {
	Register(req *RegisterRequest) (*User, error)
	GetProfile(userID uuid.UUID) (*User, error)
	UpdateProfile(userID uuid.UUID, req *UpdateProfileRequest) (*User, error)
	ChangePassword(userID uuid.UUID, req *ChangePasswordRequest) error
	SetPin(userID uuid.UUID, req *SetPinRequest) error
	VerifyPin(userID uuid.UUID, pin string) error
}

