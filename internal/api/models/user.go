package models

// User is the model for a user
type User struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}
