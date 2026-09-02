package logger

import (
	"log"

	"go.uber.org/zap"
)

var Logger = zap.NewNop().Sugar()

func InitLogger() {
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatal(err)
	}
	Logger = logger.Sugar()
}

func CloseLogger() {
	if Logger != nil {
		_ = Logger.Sync()
	}
}
