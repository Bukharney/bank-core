package utils

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/bukharney/bank-core/internal/responses"
	"github.com/google/uuid"
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

// GenerateReference generates a unique transaction/journal reference
func GenerateReference(prefix string) string {
	return fmt.Sprintf("%s-%s-%s", prefix, time.Now().Format("20060102150405"), uuid.New().String()[:8])
}

// TransactionReference is a helper function to generate a transaction reference
func TransactionReference() string {
	return GenerateReference("TXN")
}

// GetIDFromRequest gets the string path parameter from request
func GetIDFromRequest(r *http.Request, key string) (string, error) {
	id := r.PathValue(key)
	if id == "" {
		return "", errors.New("missing path parameter: " + key)
	}

	return id, nil
}

// StringToInt converts a string to an int
func StringToInt(s string) (int, error) {
	return strconv.Atoi(s)
}

// StringToInt64 converts a string to an int64
func StringToInt64(s string) (int64, error) {
	return strconv.ParseInt(s, 10, 64)
}

// ParseUUID converts a string to uuid.UUID
func ParseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

// HashPayload computes the SHA-256 hash of a byte slice payload,
// stripping transient authentication credentials (such as "pin" and "password")
// so that PIN retries do not conflict with the transaction's idempotency key.
func HashPayload(payload []byte) string {
	if len(payload) == 0 {
		hash := sha256.Sum256(payload)
		return hex.EncodeToString(hash[:])
	}

	var m map[string]interface{}
	if err := json.Unmarshal(payload, &m); err == nil {
		delete(m, "pin")
		delete(m, "password")
		delete(m, "confirm_pin")
		delete(m, "confirm_password")
		if cleaned, err := json.Marshal(m); err == nil {
			hash := sha256.Sum256(cleaned)
			return hex.EncodeToString(hash[:])
		}
	}

	hash := sha256.Sum256(payload)
	return hex.EncodeToString(hash[:])
}

// FormatMinorUnits formats integer cents/satang to decimal string (e.g. 10050 -> "100.50 THB")
func FormatMinorUnits(amount int64, currency string) string {
	dollars := amount / 100
	cents := amount % 100
	if cents < 0 {
		cents = -cents
	}
	return fmt.Sprintf("%d.%02d %s", dollars, cents, currency)
}
