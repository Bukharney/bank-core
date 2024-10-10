package utils

import (
	"net/http"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

/*
GenerateToken generates a JWT token

t is a boolean that determines the secret to use
If t is true, the function will use the refresh token secret
If t is false, the function will use the access token secret
*/
func GenerateToken(cfg *config.Config, userId uuid.UUID, t bool) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": userId,
		"exp":    time.Now().Add(time.Hour * 24).Unix(),
	})

	return token.SignedString([]byte(cfg.JWTSecret[t]))
}

// ParseToken parses a JWT token
func ParseToken(cfg *config.Config, tokenString string, t bool) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(cfg.JWTSecret[t]), nil
	})
	if err != nil {
		return "", err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", err
	}

	return claims["userId"].(string), nil
}

// ValidateToken validates a JWT token
func ValidateToken(cfg *config.Config, tokenString string, t bool) bool {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(cfg.JWTSecret[t]), nil
	})
	if err != nil {
		return false
	}

	_, ok := token.Claims.(jwt.MapClaims)
	return ok && token.Valid
}

// GetUsernameFromToken gets the username from a JWT token
func GetUsernameFromToken(cfg *config.Config, tokenString string, t bool) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(cfg.JWTSecret[t]), nil
	})
	if err != nil {
		return "", err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", err
	}

	return claims["userId"].(string), nil
}

// GetExpirationFromToken gets the expiration time from a JWT token
func GetExpirationFromToken(cfg *config.Config, tokenString string, t bool) (int64, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(cfg.JWTSecret[t]), nil
	})
	if err != nil {
		return 0, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return 0, err
	}

	return int64(claims["exp"].(float64)), nil
}

// SetToken sets the JWT token in a cookie
func SetToken(w http.ResponseWriter, token *models.LoginResponse, time time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    token.AccessToken,
		Expires:  time,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    token.RefreshToken,
		Expires:  time,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})
}
