package models

type AuthUsecase interface {
	Login(user *UserCredentials) (*LoginResponse, error)
	Logout(refreshToken string) error
	RefreshToken(refreshToken string) (*LoginResponse, error)
	Me(token string) (*User, error)
}

type AuthRepository interface {
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
