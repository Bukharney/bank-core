package repositories

import (
	"database/sql"

	"github.com/bukharney/bank-core/internal/api/models"
)

// AuthRepository is the repository for the auth routes
type AuthRepository struct {
	db *sql.DB
}

// NewAuthRepository creates a new AuthRepository
func NewAuthRepository(db *sql.DB) *AuthRepository {
	return &AuthRepository{
		db: db,
	}
}

// Register registers a new user
func (r *AuthRepository) Register(user *models.User) error {
	_, err := r.db.Exec("INSERT INTO users (email, password) VALUES ($1, $2)", user.Email, user.Password)
	if err != nil {
		return err
	}
	return nil
}
