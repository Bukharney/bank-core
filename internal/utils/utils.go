package utils

import "net/http"

// ExtractToken extracts the token from the Cookie header
func ExtractToken(r *http.Request, name string) (string, error) {
	cookie, err := r.Cookie(name)
	if err != nil {
		return "", err
	}

	return cookie.Value, nil
}
