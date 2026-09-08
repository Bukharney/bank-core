package logger

import (
	"fmt"
	"log/slog"
	"os"
)

// SlogWrapper provides standard formatted logging methods backed by log/slog
type SlogWrapper struct {
	logger *slog.Logger
}

func (l *SlogWrapper) Infof(format string, args ...interface{}) {
	l.logger.Info(fmt.Sprintf(format, args...))
}

func (l *SlogWrapper) Errorf(format string, args ...interface{}) {
	l.logger.Error(fmt.Sprintf(format, args...))
}

func (l *SlogWrapper) Info(args ...interface{}) {
	l.logger.Info(fmt.Sprint(args...))
}

func (l *SlogWrapper) Infoln(args ...interface{}) {
	l.logger.Info(fmt.Sprint(args...))
}

func (l *SlogWrapper) Fatalf(format string, args ...interface{}) {
	l.logger.Error(fmt.Sprintf(format, args...))
	os.Exit(1)
}

// Logger is the application-wide structured logger
var Logger = &SlogWrapper{logger: slog.Default()}

func InitLogger() {
	handler := slog.NewJSONHandler(os.Stdout, nil)
	Logger = &SlogWrapper{logger: slog.New(handler)}
}

func CloseLogger() {
	// log/slog does not require syncing
}
