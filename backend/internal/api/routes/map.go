package routes

import (
	"net/http"
	"time"

	"github.com/bukharney/bank-core/internal/api/controllers"
	"github.com/bukharney/bank-core/internal/api/middleware"
	"github.com/bukharney/bank-core/internal/api/repositories"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/atm"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/jmoiron/sqlx"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

// MapHandler maps the routes to the handlers
func MapHandler(config *config.Config, handler *http.ServeMux, pg *sqlx.DB, rdb *redis.Client) {
	// Clients
	atmClient := atm.NewATMClient()

	// Repositories
	userRepository := repositories.NewUserRepository(pg, rdb, config)
	authRepository := repositories.NewAuthRepository(pg, rdb, config)
	accountRepository := repositories.NewAccountRepository(pg, rdb, config)
	ledgerRepository := repositories.NewLedgerRepository(pg, rdb, config)
	outboxRepository := repositories.NewOutboxRepository(pg, rdb, config)
	idempotencyRepository := repositories.NewIdempotencyRepository(pg, rdb, config)

	// Usecases
	userUseCase := usecases.NewUserUsecase(config, userRepository, accountRepository)
	authUseCase := usecases.NewAuthUsecase(config, authRepository, userRepository)
	accountUseCase := usecases.NewAccountUsecase(config, accountRepository, userRepository)
	ledgerUseCase := usecases.NewLedgerUsecase(config, pg, ledgerRepository, accountRepository)
	transferUseCase := usecases.NewTransferUsecase(config, pg, accountRepository, userRepository, ledgerRepository, outboxRepository, atmClient)

	// Controllers
	userHandler := controllers.NewUserController(config, userUseCase)
	authHandler := controllers.NewAuthController(config, authUseCase)
	accountHandler := controllers.NewAccountController(config, accountUseCase)
	transactionHandler := controllers.NewTransactionController(config, transferUseCase)
	ledgerHandler := controllers.NewLedgerController(config, ledgerUseCase, accountRepository)

	// Idempotency Middleware for mutating operations
	idempotencyMiddleware := middleware.IdempotencyMiddleware(idempotencyRepository, config, 30*time.Second)

	// Transaction routes (Protected by Idempotency Gateway)
	transactionRouter := http.NewServeMux()
	transactionRouter.HandleFunc("POST /transfer", transactionHandler.TransferHandler)
	transactionRouter.HandleFunc("POST /deposit", transactionHandler.DepositHandler)
	transactionRouter.HandleFunc("POST /withdraw", transactionHandler.WithdrawHandler)
	transactionRouter.HandleFunc("POST /withdraw/request", transactionHandler.RequestCardlessWithdrawalHandler)
	transactionRouter.HandleFunc("POST /withdraw/verify", transactionHandler.VerifyCardlessWithdrawalHandler)
	transactionRouter.HandleFunc("POST /withdraw/confirm", transactionHandler.ConfirmCardlessWithdrawalHandler)
	transactionRouter.HandleFunc("POST /atm/deposit/lookup", transactionHandler.ATMDepositLookupHandler)
	transactionRouter.HandleFunc("POST /atm/deposit", transactionHandler.ATMDepositHandler)
	handler.Handle("/transaction/", http.StripPrefix("/transaction", idempotencyMiddleware(transactionRouter)))

	// Ledger routes
	ledgerRouter := http.NewServeMux()
	ledgerRouter.HandleFunc("GET /statement/{id}", ledgerHandler.GetAccountStatementHandler)
	ledgerRouter.HandleFunc("GET /journal/{id}", ledgerHandler.GetJournalDetailsHandler)
	handler.Handle("/ledger/", http.StripPrefix("/ledger", ledgerRouter))

	accountRouter := http.NewServeMux()
	accountRouter.HandleFunc("POST /create", accountHandler.CreateAccountHandler)
	accountRouter.HandleFunc("POST /link-phone", accountHandler.LinkPhoneHandler)
	accountRouter.HandleFunc("POST /unlink-phone", accountHandler.UnlinkPhoneHandler)
	accountRouter.HandleFunc("GET /preview/{id}", accountHandler.GetAccountPreviewHandler)
	accountRouter.HandleFunc("GET /{id}", accountHandler.GetAccountByIDHandler)
	accountRouter.HandleFunc("GET /{$}", accountHandler.GetAccountHandler)
	handler.Handle("/account/", http.StripPrefix("/account", idempotencyMiddleware(accountRouter)))
	handler.Handle("/account", idempotencyMiddleware(http.HandlerFunc(accountHandler.GetAccountHandler)))

	// User routes
	userRouter := http.NewServeMux()
	userRouter.HandleFunc("POST /register", userHandler.RegisterHandler)
	userRouter.HandleFunc("PATCH /profile", userHandler.UpdateProfileHandler)
	userRouter.HandleFunc("PUT /profile", userHandler.UpdateProfileHandler)
	userRouter.HandleFunc("POST /change-password", userHandler.ChangePasswordHandler)
	userRouter.HandleFunc("POST /pin", userHandler.SetPinHandler)
	handler.Handle("/user/", http.StripPrefix("/user", userRouter))

	// Auth routes
	authRouter := http.NewServeMux()
	authRouter.HandleFunc("POST /login", authHandler.LoginHandler)
	authRouter.HandleFunc("GET /logout", authHandler.LogoutHandler)
	authRouter.HandleFunc("GET /me", authHandler.MeHandler)
	authRouter.HandleFunc("GET /refresh", authHandler.RefreshTokenHandler)
	authRouter.HandleFunc("GET /test", authHandler.TestHandler)
	handler.Handle("/auth/", http.StripPrefix("/auth", authRouter))

	// Health Check Endpoint
	handler.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// Prometheus Metrics Scrape Endpoint
	handler.Handle("GET /metrics", promhttp.Handler())
}
