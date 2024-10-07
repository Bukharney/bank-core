package db

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/bukharney/bank-core/internal/config"
	logger "github.com/bukharney/bank-core/internal/logs"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

// Connect connects to the database
func Connect(cfg *config.Config) (*pgx.Conn, error) {
	conn, err := pgx.Connect(context.Background(), cfg.DB.URL)
	if err != nil {
		return nil, err
	}

	err = conn.Ping(context.Background())
	if err != nil {
		return nil, err
	}

	logger.Logger.Infoln("Connected to the database")

	// err = Migrate(conn)
	// if err != nil {
	// 	return nil, err
	// }

	return conn, nil
}

// Migrate migrates the database
func Migrate(db *pgx.Conn) error {
	files, err := os.ReadDir("./internal/db/migrations")
	if err != nil {
		return err
	}

	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".sql") {
			continue
		}

		data, err := os.ReadFile(fmt.Sprintf("./internal/db/migrations/%s", file.Name()))
		if err != nil {
			return err
		}

		_, err = db.Exec(context.Background(), string(data))
		if err != nil {
			return err
		}

		logger.Logger.Infoln("Migrated: ", file.Name())
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
