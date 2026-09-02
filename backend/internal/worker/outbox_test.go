package worker_test

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/worker"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// MockOutboxRepository simulates the outbox repository in memory
type MockOutboxRepository struct {
	mu     sync.Mutex
	events map[uuid.UUID]*models.OutboxEvent
}

func newMockOutboxRepository() *MockOutboxRepository {
	return &MockOutboxRepository{
		events: make(map[uuid.UUID]*models.OutboxEvent),
	}
}

func (m *MockOutboxRepository) InsertOutboxEvent(event *models.OutboxEvent) error {
	return m.InsertOutboxEventTx(nil, event)
}

func (m *MockOutboxRepository) InsertOutboxEventTx(tx *sqlx.Tx, event *models.OutboxEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	m.events[event.ID] = event
	return nil
}

func (m *MockOutboxRepository) FetchPendingEvents(ctx context.Context, batchSize int) ([]*models.OutboxEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var result []*models.OutboxEvent
	for _, e := range m.events {
		if (e.Status == models.OutboxStatusPending || e.Status == models.OutboxStatusFailed) && e.RetryCount < e.MaxRetries {
			e.Status = models.OutboxStatusProcessing
			result = append(result, e)
			if len(result) >= batchSize {
				break
			}
		}
	}
	return result, nil
}

func (m *MockOutboxRepository) MarkPublished(ctx context.Context, eventID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if e, ok := m.events[eventID]; ok {
		e.Status = models.OutboxStatusPublished
		now := time.Now()
		e.ProcessedAt = &now
	}
	return nil
}

func (m *MockOutboxRepository) MarkFailed(ctx context.Context, eventID uuid.UUID, errMsg string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if e, ok := m.events[eventID]; ok {
		e.RetryCount++
		e.LastError = &errMsg
		if e.RetryCount >= e.MaxRetries {
			e.Status = models.OutboxStatusFailed
		} else {
			e.Status = models.OutboxStatusPending
		}
	}
	return nil
}

// MockPublisher records published events
type MockPublisher struct {
	mu          sync.Mutex
	published   []*models.OutboxEvent
	shouldFail  bool
	failMessage string
}

func (p *MockPublisher) Publish(ctx context.Context, event *models.OutboxEvent) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.shouldFail {
		return errors.New(p.failMessage)
	}
	p.published = append(p.published, event)
	return nil
}

func TestOutboxWorker_ProcessBatch_Success(t *testing.T) {
	repo := newMockOutboxRepository()
	pub := &MockPublisher{}

	eventID := uuid.New()
	payload, _ := json.Marshal(map[string]string{"account_id": "1", "amount": "1000"})
	event := &models.OutboxEvent{
		ID:            eventID,
		AggregateType: "TRANSFER",
		AggregateID:   "TX-100",
		EventType:     models.EventMoneyTransferred,
		Payload:       payload,
		Status:        models.OutboxStatusPending,
		MaxRetries:    5,
	}
	_ = repo.InsertOutboxEventTx(nil, event)

	outboxWorker := worker.NewOutboxWorker(repo, pub, 100*time.Millisecond, 10)
	count, err := outboxWorker.ProcessBatch(context.Background())
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed event, got %d", count)
	}

	if len(pub.published) != 1 {
		t.Fatalf("expected publisher to receive 1 event, got %d", len(pub.published))
	}

	if repo.events[eventID].Status != models.OutboxStatusPublished {
		t.Fatalf("expected event status to be PUBLISHED, got %s", repo.events[eventID].Status)
	}
}

func TestOutboxWorker_ProcessBatch_FailureAndRetry(t *testing.T) {
	repo := newMockOutboxRepository()
	pub := &MockPublisher{
		shouldFail:  true,
		failMessage: "broker connection timeout",
	}

	eventID := uuid.New()
	event := &models.OutboxEvent{
		ID:            eventID,
		AggregateType: "ACCOUNT",
		AggregateID:   "ACC-1",
		EventType:     models.EventAccountCreated,
		Payload:       []byte(`{}`),
		Status:        models.OutboxStatusPending,
		RetryCount:    0,
		MaxRetries:    3,
	}
	_ = repo.InsertOutboxEventTx(nil, event)

	outboxWorker := worker.NewOutboxWorker(repo, pub, 100*time.Millisecond, 10)
	count, err := outboxWorker.ProcessBatch(context.Background())
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed event, got %d", count)
	}

	if repo.events[eventID].RetryCount != 1 {
		t.Fatalf("expected retry_count = 1, got %d", repo.events[eventID].RetryCount)
	}
	if repo.events[eventID].Status != models.OutboxStatusPending {
		t.Fatalf("expected status to be PENDING after retry, got %s", repo.events[eventID].Status)
	}
	if repo.events[eventID].LastError == nil || *repo.events[eventID].LastError != "broker connection timeout" {
		t.Fatalf("expected last_error to be set properly")
	}
}

func TestOutboxWorker_ProcessBatch_MaxRetriesExceeded(t *testing.T) {
	repo := newMockOutboxRepository()
	pub := &MockPublisher{
		shouldFail:  true,
		failMessage: "permanent failure",
	}

	eventID := uuid.New()
	event := &models.OutboxEvent{
		ID:            eventID,
		AggregateType: "ACCOUNT",
		AggregateID:   "ACC-1",
		EventType:     models.EventAccountCreated,
		Payload:       []byte(`{}`),
		Status:        models.OutboxStatusPending,
		RetryCount:    2,
		MaxRetries:    3,
	}
	_ = repo.InsertOutboxEventTx(nil, event)

	outboxWorker := worker.NewOutboxWorker(repo, pub, 100*time.Millisecond, 10)
	count, err := outboxWorker.ProcessBatch(context.Background())
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed event, got %d", count)
	}

	if repo.events[eventID].RetryCount != 3 {
		t.Fatalf("expected retry_count = 3, got %d", repo.events[eventID].RetryCount)
	}
	if repo.events[eventID].Status != models.OutboxStatusFailed {
		t.Fatalf("expected status to be FAILED, got %s", repo.events[eventID].Status)
	}
}

func TestOutboxWorker_ProcessBatch_EmptyQueue(t *testing.T) {
	repo := newMockOutboxRepository()
	pub := &MockPublisher{}

	outboxWorker := worker.NewOutboxWorker(repo, pub, 100*time.Millisecond, 10)
	count, err := outboxWorker.ProcessBatch(context.Background())
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 processed events, got %d", count)
	}
	if len(pub.published) != 0 {
		t.Fatalf("expected no published events, got %d", len(pub.published))
	}
}

func TestOutboxWorker_StartAndStop(t *testing.T) {
	repo := newMockOutboxRepository()
	pub := &MockPublisher{}

	outboxWorker := worker.NewOutboxWorker(repo, pub, 50*time.Millisecond, 10)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	outboxWorker.Start(ctx)
	time.Sleep(100 * time.Millisecond)
	outboxWorker.Stop()
}
