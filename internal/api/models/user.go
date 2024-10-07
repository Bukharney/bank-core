package models

import (
	"time"

	"github.com/google/uuid"
)

// User is the model for a user
type User struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Username  string    `json:"username" db:"username" validate:"required"`
	FirstName string    `json:"first_name" db:"first_name" validate:"required"`
	LastName  string    `json:"last_name" db:"last_name" validate:"required"`
	Email     string    `json:"email" db:"email" validate:"required"`
	Password  string    `json:"password" db:"password" validate:"required"`
	CreateAt  time.Time `json:"created_at" db:"created_at"`
}
