package db

import (
	"context"
	"embed"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/bukharney/bank-core/internal/config"
	logger "github.com/bukharney/bank-core/internal/logs"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

// Connect connects to the database
func Connect(cfg *config.Config) (*sqlx.DB, error) {
	db, err := sqlx.Connect("pgx", cfg.DB.URL)
	if err != nil {
		return nil, err
	}

	err = Migrate(db)
	if err != nil {
		return nil, err
	}

	logger.Logger.Infoln("Connected to the postgres")
	return db, nil
}

//go:embed migrations/*.sql
var migrationFS embed.FS

// Migrate migrates the database
func Migrate(db *sqlx.DB) error {
	entries, err := migrationFS.ReadDir("migrations")
	if err == nil && len(entries) > 0 {
		var sqlFiles []string
		for _, entry := range entries {
			if strings.HasSuffix(entry.Name(), ".sql") {
				sqlFiles = append(sqlFiles, entry.Name())
			}
		}

		sort.Slice(sqlFiles, func(i, j int) bool {
			if sqlFiles[i] == "init.sql" {
				return true
			}
			if sqlFiles[j] == "init.sql" {
				return false
			}
			return sqlFiles[i] < sqlFiles[j]
		})

		for _, fileName := range sqlFiles {
			content, err := migrationFS.ReadFile("migrations/" + fileName)
			if err != nil {
				return err
			}

			_, err = db.Exec(string(content))
			if err != nil {
				return fmt.Errorf("migration %s failed: %w", fileName, err)
			}
		}
		return nil
	}

	migrationDir := "./internal/db/migrations"
	if _, err := os.Stat(migrationDir); os.IsNotExist(err) {
		if _, err := os.Stat("../internal/db/migrations"); err == nil {
			migrationDir = "../internal/db/migrations"
		}
	}

	files, err := os.ReadDir(migrationDir)
	if err != nil {
		return err
	}

	var sqlFiles []string
	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".sql") {
			sqlFiles = append(sqlFiles, file.Name())
		}
	}

	sort.Slice(sqlFiles, func(i, j int) bool {
		if sqlFiles[i] == "init.sql" {
			return true
		}
		if sqlFiles[j] == "init.sql" {
			return false
		}
		return sqlFiles[i] < sqlFiles[j]
	})

	for _, fileName := range sqlFiles {
		migration, err := os.ReadFile(fmt.Sprintf("%s/%s", migrationDir, fileName))
		if err != nil {
			return err
		}

		_, err = db.Exec(string(migration))
		if err != nil {
			return fmt.Errorf("migration %s failed: %w", fileName, err)
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
