package models

// AuthUsecase is the usecase for the auth routes
type AuthUsecase interface {
	Register(user *User) error
}

// AuthRepository is the repository for the auth routes
type AuthRepository interface {
	Register(user *User) error
}
