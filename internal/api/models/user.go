package models

import (
	"time"

	"github.com/google/uuid"
)

type UserUsecase interface {
	Register(user *User) (int, error)
}

type UserRepository interface {
	GetUserByEmail(email string) (*User, error)
	GetUserById(id string) (*User, error)
	Register(user *User, account *Account) error
}

type User struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Role      string    `json:"role" db:"role"`
	Username  string    `json:"username" db:"username" validate:"required"`
	FirstName string    `json:"first_name" db:"first_name" validate:"required"`
	LastName  string    `json:"last_name" db:"last_name" validate:"required"`
	Email     string    `json:"email" db:"email" validate:"required"`
	Password  string    `json:"password" db:"password" validate:"required"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
