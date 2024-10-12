package utils

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/bukharney/bank-core/internal/responses"
)

// UseTimeout uses a timeout for the request
func UseTimeout(ctx context.Context, timeout time.Duration, w http.ResponseWriter, r *http.Request, handlerFunc func(context.Context)) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	done := make(chan struct{})

	go func() {
		defer close(done)
		handlerFunc(ctx)
	}()

	select {
	case <-ctx.Done():
		responses.Timeout(w, ctx.Err())
	case <-done:
	}
}

// ExtractToken extracts the token from the Cookie header
func ExtractToken(r *http.Request, name string) (string, error) {
	cookie, err := r.Cookie(name)
	if err != nil {
		return "", err
	}

	return cookie.Value, nil
}

// DecodeJSON decodes the JSON body of the request
func DecodeJSON(r *http.Request, data interface{}) error {
	return json.NewDecoder(r.Body).Decode(data)
}
