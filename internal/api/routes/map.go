package routes

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/controllers"
	"github.com/bukharney/bank-core/internal/api/repositories"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

// MapHandler maps the routes to the handlers

func MapHandler(config *config.Config, handler *http.ServeMux, pg *sqlx.DB, rdb *redis.Client) {
	AuthRepository := repositories.NewAuthRepository(pg, rdb, config)
	authUseCase := usecases.NewAuthUsecase(config, AuthRepository)
	authHandler := controllers.NewAuthController(config, authUseCase)

	authRouter := http.NewServeMux()
	authRouter.HandleFunc("POST /register", authHandler.RegisterHandler)
	authRouter.HandleFunc("POST /login", authHandler.LoginHandler)
	authRouter.HandleFunc("GET /logout", authHandler.LogoutHandler)
	authRouter.HandleFunc("GET /me", authHandler.MeHandler)
	authRouter.HandleFunc("GET /refresh", authHandler.RefreshTokenHandler)

	handler.Handle("/auth/", http.StripPrefix("/auth", authRouter))
}
