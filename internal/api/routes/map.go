package routes

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/controllers"
	"github.com/bukharney/bank-core/internal/api/repositories"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/db"
)

// MapHandler maps the routes to the handlers

func MapHandler(config *config.Config, handler *http.ServeMux) {
	db, err := db.Connect(config)
	if err != nil {
		panic(err)
	}

	AuthRepository := repositories.NewAuthRepository(db)
	authUseCase := usecases.NewAuthUsecase(AuthRepository)
	authHandler := controllers.NewAuthController(authUseCase)

	handler.HandleFunc("/register", authHandler.RegisterHandler)
}
