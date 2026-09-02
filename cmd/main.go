package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bukharney/bank-core/internal/api/middleware"
	"github.com/bukharney/bank-core/internal/api/repositories"
	"github.com/bukharney/bank-core/internal/api/routes"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/db"
	logger "github.com/bukharney/bank-core/internal/logs"
	"github.com/bukharney/bank-core/internal/worker"
)

// Main application entrypoint
func main() {
	logger.InitLogger()
	defer logger.CloseLogger()

	cfg := config.NewConfig()

	pg, err := db.Connect(cfg)
	if err != nil {
		panic(err)
	}

	rdb, err := db.RedisConnect(cfg)
	if err != nil {
		panic(err)
	}

	// 1. Initialize Transactional Outbox Background Worker
	outboxRepo := repositories.NewOutboxRepository(pg, rdb, cfg)
	outboxPublisher := worker.NewRedisPublisher(rdb)
	outboxWorker := worker.NewOutboxWorker(outboxRepo, outboxPublisher, 1*time.Second, 25)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	outboxWorker.Start(ctx)

	// 2. Setup HTTP Server & Routes
	mux := http.NewServeMux()
	routes.MapHandler(cfg, mux, pg, rdb)
	serv := middleware.ApplyMiddleware(mux)

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: serv,
	}

	// 3. Graceful Shutdown on SIGINT / SIGTERM
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		logger.Logger.Infof("Bank Core Server is running on port %s", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Logger.Fatalf("HTTP server error: %v", err)
		}
	}()

	<-stopChan
	logger.Logger.Info("Shutting down Bank Core Server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		logger.Logger.Errorf("HTTP server shutdown failed: %v", err)
	}

	// Stop Outbox Worker
	outboxWorker.Stop()
	logger.Logger.Info("Bank Core Server gracefully stopped.")
}
