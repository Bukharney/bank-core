package config

type DBConfig struct {
	DSN          string
	MaxOpenConns int
	MaxIdleConns int
	MaxIdleTime  string
}

type Config struct {
	DB DBConfig
}

// NewConfig creates a new Config
func NewConfig() *Config {
	return &Config{
		DB: DBConfig{
			DSN:          "postgres://postgres:password@localhost:5432/bank?sslmode=disable",
			MaxOpenConns: 10,
			MaxIdleConns: 10,
			MaxIdleTime:  "5m",
		},
	}
}
