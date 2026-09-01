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
	ID           uuid.UUID `json:"id" db:"id"`
	Username     string    `json:"username" db:"username" validate:"required,min=3,max=50"`
	Email        string    `json:"email" db:"email" validate:"required,email"`
	PhoneNumber  *string   `json:"phone_number" db:"phone_number"`
	PasswordHash string    `json:"-" db:"password_hash"`
	FirstName    string    `json:"first_name" db:"first_name" validate:"required"`
	LastName     string    `json:"last_name" db:"last_name" validate:"required"`
	Role         string    `json:"role" db:"role"`
	Status       string    `json:"status" db:"status"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type RegisterRequest struct {
	Username    string `json:"username" validate:"required,min=3,max=50"`
	Email       string `json:"email" validate:"required,email"`
	PhoneNumber string `json:"phone_number"`
	Password    string `json:"password" validate:"required,min=8"`
	FirstName   string `json:"first_name" validate:"required"`
	LastName    string `json:"last_name" validate:"required"`
}

type UserRepository interface {
	GetUserByEmail(email string) (*User, error)
	GetUserByID(id uuid.UUID) (*User, error)
	GetUserByUsername(username string) (*User, error)
	GetUserByPhone(phone string) (*User, error)
	CreateUser(user *User) error
	UpdateUserStatus(id uuid.UUID, status string) error
}

type UserUsecase interface {
	Register(req *RegisterRequest) (*User, error)
	GetProfile(userID uuid.UUID) (*User, error)
}
