package main

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/middleware"
	"github.com/bukharney/bank-core/internal/api/routes"
	"github.com/bukharney/bank-core/internal/config"
	logger "github.com/bukharney/bank-core/internal/logs"
)

func main() {
	logger.InitLogger()
	defer logger.CloseLogger()
	mux := http.NewServeMux()

	config := config.NewConfig()

	routes.MapHandler(config, mux)

	serv := middleware.ApplyMiddleware(mux)

	http.ListenAndServe(":8080", serv)
}
