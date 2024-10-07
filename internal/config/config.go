package config

type DBConfig struct {
	URL string
}

type Redis struct {
	URL      string
	Password string
	DB       int
}

type Config struct {
	DB        DBConfig
	JWTSecret map[bool]string
	Redis     Redis
}

// NewConfig creates a new Config
func NewConfig() *Config {
	return &Config{
		DB: DBConfig{
			URL: "postgres://postgres:postgres@localhost:5432/bank?sslmode=disable",
		},
		JWTSecret: map[bool]string{
			true:  "refresh",
			false: "access",
		},
		Redis: Redis{
			URL:      "localhost:6379",
			Password: "root",
			DB:       0,
		},
	}
}
