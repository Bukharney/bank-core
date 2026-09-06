package session

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

type SessionM interface {
	ValidateSession(sessionID string) bool
	CreateSession(t time.Duration) string
}

type Session struct {
	session  map[string]time.Time
	mu       sync.RWMutex
	filePath string
}

// NewSession creates a new session and initializes it.
func NewSession(atmID ...int) SessionM {
	filePath := "session.txt"
	if len(atmID) > 0 && atmID[0] > 0 {
		filePath = fmt.Sprintf("session_%d.txt", atmID[0])
	}

	s := &Session{
		session:  make(map[string]time.Time),
		filePath: filePath,
	}
	s.init(time.Second * 10)
	return s
}

// ValidateSession validates a session.
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

// CreateSession creates a new session.
// t is the duration for which the session is valid.
func (s *Session) CreateSession(t time.Duration) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	sessionID := fmt.Sprintf("%d", time.Now().UnixNano())
	s.session[sessionID] = time.Now().Add(t)
	return sessionID
}

// sessionCleanup cleans up expired sessions.
func (s *Session) sessionCleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for k, v := range s.session {
		if now.After(v) {
			delete(s.session, k)
		}
	}
}

// writeSession to file
func (s *Session) writeSession() {
	s.mu.RLock()
	snapshot := make(map[string]time.Time, len(s.session))
	for k, v := range s.session {
		snapshot[k] = v
	}
	s.mu.RUnlock()

	f, err := os.Create(s.filePath)
	if err != nil {
		fmt.Printf("[%s] failed to create session file: %v\n", s.filePath, err)
		return
	}
	defer f.Close()

	w := bufio.NewWriter(f)
	for k, v := range snapshot {
		_, err := fmt.Fprintf(w, "%s %s\n", k, v.Format(time.RFC3339Nano))
		if err != nil {
			fmt.Printf("[%s] error writing session: %v\n", s.filePath, err)
			return
		}
	}
	_ = w.Flush()
}

// readSession from file
func (s *Session) readSession() {
	f, err := os.Open(s.filePath)
	if err != nil {
		// Fresh startup without previous session file is normal
		if !os.IsNotExist(err) {
			fmt.Printf("[%s] error reading session file: %v\n", s.filePath, err)
		}
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	s.mu.Lock()
	defer s.mu.Unlock()

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, " ", 2)
		if len(parts) != 2 {
			continue
		}
		sessionID := parts[0]
		sessionTimeStr := parts[1]

		t, err := time.Parse(time.RFC3339Nano, sessionTimeStr)
		if err != nil {
			t, err = time.Parse("2006-01-02 15:04:05.999999999 -0700 MST", sessionTimeStr)
			if err != nil {
				continue
			}
		}

		if time.Now().Before(t) {
			s.session[sessionID] = t
		}
	}
}

// init initializes the session package.
// t is the period after which the session cleanup process is triggered.
func (s *Session) init(t time.Duration) {
	s.readSession()

	go func() {
		for {
			time.Sleep(t)
			s.sessionCleanup()
			s.writeSession()
		}
	}()
}
