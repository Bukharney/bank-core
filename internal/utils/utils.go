package utils

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
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

// DecodeJSON decodes the JSON body of the request
func DecodeJSON(r *http.Request, data interface{}) error {
	return json.NewDecoder(r.Body).Decode(data)
}

// TransactionReference is a helper function to generate a transaction reference
func TransactionReference() string {
	return time.Now().Format("20060102150405")
}

// GetUserIdFromRequest gets the user ID from the request
func GetIDFromRequest(r *http.Request, key string) (string, error) {
	id := r.Context().Value(key)
	if id == nil {
		return "", errors.New("ID not found")
	}

	return id.(string), nil
}

// StringToInt converts a string to an int
func StringToInt(s string) (int, error) {
	return strconv.Atoi(s)
}
