package session

import (
	"fmt"
	"time"
)

type Session struct {
	session map[string]time.Time
}

// NewSession creates a new session and initializes it.
func NewSession() Session {
	s := Session{
		session: make(map[string]time.Time),
	}
	s.init(time.Minute * 1)
	return s
}

// ValidateSession validates a session.
func (s *Session) ValidateSession(sessionID string) bool {
	_, ok := s.session[sessionID]
	return ok
}

// CreateSession creates a new session.
// t is the duration for which the session is valid.
func (s *Session) CreateSession(t time.Duration) string {
	sessionID := fmt.Sprintf("%d", time.Now().UnixNano())
	s.session[sessionID] = time.Now().Add(t)
	return sessionID
}

// sessionCleanup cleans up expired sessions.
func (s *Session) sessionCleanup() {
	for k, v := range s.session {
		if time.Now().After(v) {
			delete(s.session, k)
		}
	}
}

// init initializes the session package.
// t is the period after which the session cleanup process is triggered.
func (s *Session) init(t time.Duration) {
	go func() {
		for {
			s.sessionCleanup()
			time.Sleep(t)
		}
	}()
}
