package session

import (
	"fmt"
	"sync"
	"time"
)

type SessionM interface {
	ValidateSession(sessionID string) bool
	CreateSession(t time.Duration) string
}

type Session struct {
	session map[string]time.Time
	mu      sync.RWMutex
}

// NewSession creates a new in-memory session manager.
func NewSession(_ ...int) SessionM {
	return &Session{
		session: make(map[string]time.Time),
	}
}

// ValidateSession validates a session ID.
func (s *Session) ValidateSession(sessionID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	expiry, ok := s.session[sessionID]
	if !ok {
		return false
	}
	if time.Now().After(expiry) {
		delete(s.session, sessionID)
		return false
	}
	return true
}

// CreateSession generates a new session valid for duration t.
func (s *Session) CreateSession(t time.Duration) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	sessionID := fmt.Sprintf("%d", time.Now().UnixNano())
	s.session[sessionID] = time.Now().Add(t)
	return sessionID
}
