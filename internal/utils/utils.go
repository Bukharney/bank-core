package utils

import "net/http"

// ExtractToken extracts the token from the Cookie header
func ExtractToken(r *http.Request, name string) string {
	cookie, err := r.Cookie(name)
	if err != nil {
		return ""
	}

	return cookie.Value
}
