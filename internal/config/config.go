package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type DBConfig struct {
	URL string
}

type Redis struct {
	URL      string
	Password string
	DB       int
}

type Config struct {
	Port      string
	DB        DBConfig
	JWTSecret map[bool]string
	Redis     Redis
}

// getEnv retrieves environment variable with a fallback default value
func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// NewConfig creates and returns a Config loaded from .env and environment variables
func NewConfig() *Config {
	// Attempt to load .env from current directory or parent directory paths
	_ = godotenv.Load(".env", "../.env", "../../.env")

	// Determine Database URL
	dbURL := getEnv("DB_URL", "")
	if dbURL == "" {
		dbURL = getEnv("DATABASE_URL", "")
	}
	if dbURL == "" {
		pgUser := getEnv("POSTGRES_USER", "postgres")
		pgPass := getEnv("POSTGRES_PASSWORD", "postgres")
		pgHost := getEnv("POSTGRES_HOST", "localhost")
		pgPort := getEnv("POSTGRES_PORT", "5432")
		pgDB := getEnv("POSTGRES_DB", "bank")
		pgSSL := getEnv("POSTGRES_SSLMODE", "disable")
		dbURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", pgUser, pgPass, pgHost, pgPort, pgDB, pgSSL)
	}

	// Redis DB index parsing
	redisDB, err := strconv.Atoi(getEnv("REDIS_DB", "0"))
	if err != nil {
		redisDB = 0
	}

	serverPort := getEnv("PORT", "")
	if serverPort == "" {
		serverPort = getEnv("SERVER_PORT", "8080")
	}

	return &Config{
		Port: serverPort,
		DB: DBConfig{
			URL: dbURL,
		},
		JWTSecret: map[bool]string{
			true:  getEnv("JWT_REFRESH_SECRET", "refresh"),
			false: getEnv("JWT_ACCESS_SECRET", "access"),
		},
		Redis: Redis{
			URL:      getEnv("REDIS_URL", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", "root"),
			DB:       redisDB,
		},
	}
}
