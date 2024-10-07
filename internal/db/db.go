package db

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/bukharney/bank-core/internal/config"
	logger "github.com/bukharney/bank-core/internal/logs"
	_ "github.com/jackc/pgx/stdlib"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

// Connect connects to the database
func Connect(cfg *config.Config) (*sqlx.DB, error) {
	db, err := sqlx.Connect("pgx", cfg.DB.URL)
	if err != nil {
		return nil, err
	}

	logger.Logger.Infoln("Connected to the postgres")
	return db, nil
}

// Migrate migrates the database
func Migrate(db *sqlx.DB) error {
	files, err := os.ReadDir("./internal/db/migrations")
	if err != nil {
		return err
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".sql") {
			migration, err := os.ReadFile(fmt.Sprintf("./internal/db/migrations/%s", file.Name()))
			if err != nil {
				return err
			}

			_, err = db.Exec(string(migration))
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func RedisConnect(cfg *config.Config) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.URL,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	_, err := client.Ping(context.Background()).Result()
	if err != nil {
		return nil, err
	}

	logger.Logger.Infoln("Connected to the redis")

	return client, nil
}
