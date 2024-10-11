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
	UserRepository := repositories.NewUserRepository(pg, rdb, config)
	UserUseCase := usecases.NewUserUsecase(config, UserRepository)
	UserHandler := controllers.NewUserController(config, UserUseCase)

	userRouter := http.NewServeMux()
	userRouter.HandleFunc("POST /register", UserHandler.RegisterHandler)
	handler.Handle("/user/", http.StripPrefix("/user", userRouter))

	AuthRepository := repositories.NewAuthRepository(pg, rdb, config)
	AuthUseCase := usecases.NewAuthUsecase(config, AuthRepository, UserRepository)
	AuthHandler := controllers.NewAuthController(config, AuthUseCase)

	authRouter := http.NewServeMux()
	authRouter.HandleFunc("POST /login", AuthHandler.LoginHandler)
	authRouter.HandleFunc("GET /logout", AuthHandler.LogoutHandler)
	authRouter.HandleFunc("GET /me", AuthHandler.MeHandler)
	authRouter.HandleFunc("GET /refresh", AuthHandler.RefreshTokenHandler)
	handler.Handle("/auth/", http.StripPrefix("/auth", authRouter))
}
