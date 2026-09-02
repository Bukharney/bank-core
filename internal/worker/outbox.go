package worker

import (
	"context"
	"sync"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	logger "github.com/bukharney/bank-core/internal/logs"
	"github.com/bukharney/bank-core/internal/metrics"
)

type OutboxWorker struct {
	repo         models.OutboxRepository
	publisher    models.OutboxPublisher
	pollInterval time.Duration
	batchSize    int
	stopChan     chan struct{}
	wg           sync.WaitGroup
	isRunning    bool
	mu           sync.Mutex
}

func NewOutboxWorker(
	repo models.OutboxRepository,
	publisher models.OutboxPublisher,
	pollInterval time.Duration,
	batchSize int,
) *OutboxWorker {
	if pollInterval <= 0 {
		pollInterval = 1 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 20
	}

	return &OutboxWorker{
		repo:         repo,
		publisher:    publisher,
		pollInterval: pollInterval,
		batchSize:    batchSize,
		stopChan:     make(chan struct{}),
	}
}

// Start runs the worker in a background goroutine
func (w *OutboxWorker) Start(ctx context.Context) {
	w.mu.Lock()
	if w.isRunning {
		w.mu.Unlock()
		return
	}
	w.isRunning = true
	w.mu.Unlock()

	w.wg.Add(1)
	go w.run(ctx)
	logger.Logger.Infof("[Outbox Worker] Started with pollInterval=%v, batchSize=%d", w.pollInterval, w.batchSize)
}

// Stop gracefully stops the background worker loop
func (w *OutboxWorker) Stop() {
	w.mu.Lock()
	if !w.isRunning {
		w.mu.Unlock()
		return
	}
	w.isRunning = false
	close(w.stopChan)
	w.mu.Unlock()

	w.wg.Wait()
	logger.Logger.Info("[Outbox Worker] Gracefully stopped")
}

func (w *OutboxWorker) run(ctx context.Context) {
	defer w.wg.Done()
	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-w.stopChan:
			return
		case <-ticker.C:
			// Process backlog until fewer than batchSize items remain
			for {
				select {
				case <-ctx.Done():
					return
				case <-w.stopChan:
					return
				default:
				}

				processedCount, err := w.ProcessBatch(ctx)
				if err != nil {
					logger.Logger.Errorf("[Outbox Worker] Error processing batch: %v", err)
					break
				}

				// If no more items in backlog, wait for next ticker
				if processedCount < w.batchSize {
					break
				}
			}
		}
	}
}

// ProcessBatch fetches a batch of pending events and publishes them
func (w *OutboxWorker) ProcessBatch(ctx context.Context) (int, error) {
	events, err := w.repo.FetchPendingEvents(ctx, w.batchSize)
	if err != nil {
		return 0, err
	}

	if len(events) == 0 {
		return 0, nil
	}

	for _, event := range events {
		pubErr := w.publisher.Publish(ctx, event)
		if pubErr != nil {
			metrics.OutboxEventsProcessedTotal.WithLabelValues(event.EventType, "failed").Inc()
			logger.Logger.Errorf("[Outbox Worker] Failed to publish event %s (ID: %s): %v", event.EventType, event.ID, pubErr)
			_ = w.repo.MarkFailed(ctx, event.ID, pubErr.Error())
		} else {
			metrics.OutboxEventsProcessedTotal.WithLabelValues(event.EventType, "success").Inc()
			_ = w.repo.MarkPublished(ctx, event.ID)
		}
	}

	return len(events), nil
}
