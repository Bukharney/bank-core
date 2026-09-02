package session

import (
	"fmt"
	"os"
	"sync"
	"time"
)

type SessionM interface {
	ValidateSession(sessionID string) bool
	CreateSession(t time.Duration) string
}

type Session struct {
	session map[string]time.Time
	mu      sync.Mutex
}

// NewSession creates a new session and initializes it.
func NewSession() SessionM {
	s := &Session{
		session: make(map[string]time.Time),
	}
	s.init(time.Second * 10)
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
	s.mu.Lock()
	sessionID := fmt.Sprintf("%d", time.Now().UnixNano())
	s.session[sessionID] = time.Now().Add(t)
	s.mu.Unlock()
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

// writeSession to file
func (s *Session) writeSession() {
	file := "session.txt"
	f, err := os.Create(file)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer f.Close()

	for k, v := range s.session {
		println(k, v.String())
		_, err := f.WriteString(fmt.Sprintf("%s %s\n", k, v.String()))
		if err != nil {
			fmt.Println(err)
			return
		}
	}
}

// readSession from file
func (s *Session) readSession() {
	file := "session.txt"
	f, err := os.Open(file)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer f.Close()

	var sessionID string
	var sessionTime string
	for {
		_, err := fmt.Fscanf(f, "%s %s\n", &sessionID, &sessionTime)
		if err != nil {
			break
		}

		t, err := time.Parse("2006-01-02 15:04:05.999999999 -0700 MST", sessionTime)
		if err != nil {
			fmt.Println(err)
			return
		}

		s.session[sessionID] = t
	}
}

// init initializes the session package.
// t is the period after which the session cleanup process is triggered.
func (s *Session) init(t time.Duration) {
	s.readSession()

	go func() {
		for {
			s.sessionCleanup()
			s.writeSession()
			time.Sleep(t)
		}
	}()
}
