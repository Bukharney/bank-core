package main

import (
	"net/http"

	"github.com/bukharney/bank-core/internal/api/middleware"
	"github.com/bukharney/bank-core/internal/api/routes"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/db"
	logger "github.com/bukharney/bank-core/internal/logs"
)

func main() {
	logger.InitLogger()
	defer logger.CloseLogger()
	mux := http.NewServeMux()

	config := config.NewConfig()
	pg, err := db.Connect(config)
	if err != nil {
		panic(err)
	}

	rdb, err := db.RedisConnect(config)
	if err != nil {
		panic(err)
	}

	routes.MapHandler(config, mux, pg, rdb)

	serv := middleware.ApplyMiddleware(mux)

	http.ListenAndServe(":8080", serv)
}
