package session

import (
	"fmt"
	"log"
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
	s.init()
	return s
}

// ValidateSession validates a session.
func (s *Session) ValidateSession(sessionID string) bool {
	_, ok := s.session[sessionID]
	return ok
}

// CreateSession creates a new session.
func (s *Session) CreateSession() string {
	sessionID := fmt.Sprintf("%d", time.Now().UnixNano())
	s.session[sessionID] = time.Now().Add(5 * time.Minute)
	return sessionID
}

// sessionCleanup cleans up expired sessions.
func (s *Session) sessionCleanup() {
	for k, v := range s.session {
		if time.Now().After(v) {
			log.Printf("Session %s has expired", k)
			delete(s.session, k)
		}
	}
}

// init initializes the session package.
func (s *Session) init() {
	go func() {
		for {
			s.sessionCleanup()
			time.Sleep(1 * time.Minute)
		}
	}()
}
