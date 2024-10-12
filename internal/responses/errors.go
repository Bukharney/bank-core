package responses

import (
	"encoding/json"
	"net/http"
)

// JSON is a helper function to return a JSON response
func JSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

// Error sends an error response
func Error(w http.ResponseWriter, statusCode int, err error) {
	JSON(w, statusCode, struct {
		Error string `json:"error"`
	}{
		Error: err.Error(),
	})
}

// Message sends a message response
func Message(w http.ResponseWriter, statusCode int, message string) {
	JSON(w, statusCode, struct {
		Message string `json:"message"`
	}{
		Message: message,
	})
}

// Success sends a success response
func Success(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusOK, data)
}

// Created sends a created response
func Created(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusCreated, data)
}

// NoContent sends a no content response
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

func InternalServerError(w http.ResponseWriter, err error) {
	Error(w, http.StatusInternalServerError, err)
}

// BadRequest sends a bad request response
func BadRequest(w http.ResponseWriter, err error) {
	Error(w, http.StatusBadRequest, err)
}

// Unauthorized sends an unauthorized response
func Unauthorized(w http.ResponseWriter, err error) {
	Error(w, http.StatusUnauthorized, err)
}

// Forbidden sends a forbidden response
func Forbidden(w http.ResponseWriter, err error) {
	Error(w, http.StatusForbidden, err)
}

// NotFound sends a not found response
func NotFound(w http.ResponseWriter, err error) {
	Error(w, http.StatusNotFound, err)
}

// Conflict sends a conflict response
func Conflict(w http.ResponseWriter, err error) {
	Error(w, http.StatusConflict, err)
}

// Timeout sends a timeout response
func Timeout(w http.ResponseWriter, err error) {
	Error(w, http.StatusRequestTimeout, err)
}
