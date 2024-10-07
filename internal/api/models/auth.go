package models

// AuthUsecase is the usecase for the auth routes
type AuthUsecase interface {
	Register(user *User) error
	Login(user *UserCredentials) (LoginResponse, error)
}

// AuthRepository is the repository for the auth routes
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
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
}
