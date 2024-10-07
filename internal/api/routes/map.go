package routes

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/controllers"
	"github.com/bukharney/bank-core/internal/api/repositories"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

// MapHandler maps the routes to the handlers

func MapHandler(config *config.Config, handler *http.ServeMux, pg *pgx.Conn, rdb *redis.Client) {
	AuthRepository := repositories.NewAuthRepository(pg, rdb, config)
	authUseCase := usecases.NewAuthUsecase(config, AuthRepository)
	authHandler := controllers.NewAuthController(authUseCase)

	handler.HandleFunc("POST /register", authHandler.RegisterHandler)
	handler.HandleFunc("POST /login", authHandler.LoginHandler)

}
