package repositories

import (
	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

// UserRepository is the repository for the user routes
type UserRepository struct {
	Cfg *config.Config
	Db  *sqlx.DB
	Rdb *redis.Client
}

// NewUserRepository creates a new UserRepository
func NewUserRepository(db *sqlx.DB, rdb *redis.Client, cfg *config.Config) *UserRepository {
	return &UserRepository{
		Db:  db,
		Rdb: rdb,
		Cfg: cfg,
	}
}

// Register registers a new user
func (r *UserRepository) Register(user *models.User) error {
	_, err := r.Db.NamedExec(`
	INSERT INTO customers (id, email, password, created_at, first_name, last_name, username) 
	VALUES (:id, :email, :password, :created_at, :first_name, :last_name, :username)
	`, user)
	if err != nil {
		return err
	}

	return nil
}

// GetUserByEmail gets a user by email
func (r *UserRepository) GetUserByEmail(email string) (*models.User, error) {
	user := &models.User{}
	err := r.Db.Get(user, "SELECT * FROM customers WHERE email = $1", email)
	if err != nil {
		return nil, err
	}

	return user, nil
}
