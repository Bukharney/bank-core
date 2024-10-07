package models

type AuthUsecase interface {
	Register(user *User) error
	Login(user *UserCredentials) (*LoginResponse, error)
}

type AuthRepository interface {
	Register(user *User) error
	GetUserByEmail(email string) (*User, error)
	UpdateRefreshToken(userId string, refreshToken string) error
}

type UserCredentials struct {
	Email    string `json:"email" required:"true"`
	Password string `json:"password" required:"true"`
}

type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}
