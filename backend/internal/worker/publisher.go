package worker

import (
	"context"
	"fmt"

	"github.com/bukharney/bank-core/internal/api/models"
	logger "github.com/bukharney/bank-core/internal/logs"
	"github.com/redis/go-redis/v9"
)

// RedisPublisher publishes domain events to Redis Pub/Sub channels
type RedisPublisher struct {
	rdb *redis.Client
}

func NewRedisPublisher(rdb *redis.Client) models.OutboxPublisher {
	return &RedisPublisher{rdb: rdb}
}

func (p *RedisPublisher) Publish(ctx context.Context, event *models.OutboxEvent) error {
	channel := fmt.Sprintf("bank.events.%s", event.EventType)
	err := p.rdb.Publish(ctx, channel, string(event.Payload)).Err()
	if err != nil {
		return fmt.Errorf("failed to publish event to redis channel %s: %w", channel, err)
	}

	logger.Logger.Infof("[Outbox Publisher] Published event %s (ID: %s) to channel %s", event.EventType, event.ID, channel)
	return nil
}

// LogPublisher is a fallback publisher that logs events
type LogPublisher struct{}

func NewLogPublisher() models.OutboxPublisher {
	return &LogPublisher{}
}

func (p *LogPublisher) Publish(ctx context.Context, event *models.OutboxEvent) error {
	logger.Logger.Infof("[Outbox LogPublisher] Event: %s, Aggregate: %s:%s, Payload: %s",
		event.EventType, event.AggregateType, event.AggregateID, string(event.Payload))
	return nil
}
