package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP Metrics
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "bank",
			Subsystem: "http",
			Name:      "requests_total",
			Help:      "Total number of HTTP requests processed by the bank core API",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "bank",
			Subsystem: "http",
			Name:      "request_duration_seconds",
			Help:      "Histogram of HTTP request latencies in seconds",
			Buckets:   []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"method", "path"},
	)

	// Banking Business & Financial Metrics
	TransactionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "bank",
			Subsystem: "ledger",
			Name:      "transactions_total",
			Help:      "Total number of financial transactions processed (transfers, deposits, withdrawals)",
		},
		[]string{"type", "status"},
	)

	TransactionAmountSatangTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "bank",
			Subsystem: "ledger",
			Name:      "transaction_amount_satang_total",
			Help:      "Total volume of financial transactions in Satang (minor units)",
		},
		[]string{"type", "currency"},
	)

	// Security & PIN Metrics
	PINAttemptsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "bank",
			Subsystem: "security",
			Name:      "pin_attempts_total",
			Help:      "Total number of transaction PIN authentication attempts and outcomes",
		},
		[]string{"result"},
	)

	// ATM Hardware Metrics
	ATMDispenseTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "bank",
			Subsystem: "atm",
			Name:      "dispense_total",
			Help:      "Total cash dispense operations per ATM machine",
		},
		[]string{"atm_id", "status"},
	)

	// Outbox Event Worker Metrics
	OutboxEventsProcessedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "bank",
			Subsystem: "outbox",
			Name:      "events_processed_total",
			Help:      "Total number of domain outbox events published to Redis / message bus",
		},
		[]string{"event_type", "status"},
	)

	OutboxPendingEventsGauge = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "bank",
			Subsystem: "outbox",
			Name:      "pending_events",
			Help:      "Current count of pending outbox events awaiting publication",
		},
	)
)
