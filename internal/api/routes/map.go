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
	// Create the repositories
	UserRepository := repositories.NewUserRepository(pg, rdb, config)
	AuthRepository := repositories.NewAuthRepository(pg, rdb, config)
	TransactionRepository := repositories.NewTransactionRepository(pg, rdb, config)
	AccountRepository := repositories.NewAccountRepository(pg, rdb, config)

	// Create the usecases
	UserUseCase := usecases.NewUserUsecase(config, UserRepository, AccountRepository)
	AuthUseCase := usecases.NewAuthUsecase(config, AuthRepository, UserRepository)
	TransactionUseCase := usecases.NewTransactionUsecase(config, TransactionRepository, AccountRepository)

	// Create the handlers
	UserHandler := controllers.NewUserController(config, UserUseCase)
	AuthHandler := controllers.NewAuthController(config, AuthUseCase)
	TransactionHandler := controllers.NewTransactionController(config, TransactionUseCase)

	// Transaction routes
	transactionRouter := http.NewServeMux()
	transactionRouter.HandleFunc("POST /transfer", TransactionHandler.TransferHandler)
	transactionRouter.HandleFunc("POST /deposit", TransactionHandler.DepositHandler)
	transactionRouter.HandleFunc("POST /withdraw", TransactionHandler.WithdrawHandler)
	handler.Handle("/transaction/", http.StripPrefix("/transaction", transactionRouter))

	// User routes
	userRouter := http.NewServeMux()
	userRouter.HandleFunc("POST /register", UserHandler.RegisterHandler)
	handler.Handle("/user/", http.StripPrefix("/user", userRouter))

	// Auth routes
	authRouter := http.NewServeMux()
	authRouter.HandleFunc("POST /login", AuthHandler.LoginHandler)
	authRouter.HandleFunc("GET /logout", AuthHandler.LogoutHandler)
	authRouter.HandleFunc("GET /me", AuthHandler.MeHandler)
	authRouter.HandleFunc("GET /refresh", AuthHandler.RefreshTokenHandler)
	handler.Handle("/auth/", http.StripPrefix("/auth", authRouter))
}
