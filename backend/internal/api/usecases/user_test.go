package usecases_test

import (
	"errors"
	"testing"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type mockUserRepo struct {
	users map[uuid.UUID]*models.User
}

func (m *mockUserRepo) GetUserByEmail(email string) (*models.User, error) {
	for _, u := range m.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockUserRepo) GetUserByID(id uuid.UUID) (*models.User, error) {
	if u, ok := m.users[id]; ok {
		return u, nil
	}
	return nil, errors.New("not found")
}

func (m *mockUserRepo) GetUserByUsername(username string) (*models.User, error) {
	for _, u := range m.users {
		if u.Username == username {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockUserRepo) GetUserByPhone(phone string) (*models.User, error) {
	for _, u := range m.users {
		if u.PhoneNumber != nil && *u.PhoneNumber == phone {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockUserRepo) CreateUser(user *models.User) error {
	m.users[user.ID] = user
	return nil
}

func (m *mockUserRepo) UpdateUserStatus(id uuid.UUID, status string) error {
	if u, ok := m.users[id]; ok {
		u.Status = status
		return nil
	}
	return errors.New("not found")
}

func (m *mockUserRepo) UpdateProfile(id uuid.UUID, firstName, lastName string, phoneNumber *string) error {
	if u, ok := m.users[id]; ok {
		u.FirstName = firstName
		u.LastName = lastName
		u.PhoneNumber = phoneNumber
		return nil
	}
	return errors.New("not found")
}

func (m *mockUserRepo) UpdatePassword(id uuid.UUID, passwordHash string) error {
	if u, ok := m.users[id]; ok {
		u.PasswordHash = passwordHash
		return nil
	}
	return errors.New("not found")
}

func (m *mockUserRepo) SetPin(id uuid.UUID, pinHash string) error {
	if u, ok := m.users[id]; ok {
		u.PinHash = &pinHash
		u.PinFailedAttempts = 0
		return nil
	}
	return errors.New("not found")
}

func (m *mockUserRepo) ResetPinFailedAttempts(id uuid.UUID) error {
	if u, ok := m.users[id]; ok {
		u.PinFailedAttempts = 0
		return nil
	}
	return errors.New("not found")
}

func (m *mockUserRepo) IncrementPinFailedAttempts(id uuid.UUID) (int, error) {
	if u, ok := m.users[id]; ok {
		u.PinFailedAttempts++
		return u.PinFailedAttempts, nil
	}
	return 0, errors.New("not found")
}

func TestUpdateProfile_Success(t *testing.T) {
	userID := uuid.New()
	phone := "0812345678"
	initialUser := &models.User{
		ID:          userID,
		Username:    "johndoe",
		Email:       "john@bank.internal",
		FirstName:   "John",
		LastName:    "Doe",
		PhoneNumber: &phone,
	}

	repo := &mockUserRepo{
		users: map[uuid.UUID]*models.User{userID: initialUser},
	}

	cfg := &config.Config{}
	uc := usecases.NewUserUsecase(cfg, repo, nil)

	newPhone := "0898765432"
	req := &models.UpdateProfileRequest{
		FirstName:   "Johnny",
		LastName:    "Smith",
		PhoneNumber: &newPhone,
	}

	updatedUser, err := uc.UpdateProfile(userID, req)
	if err != nil {
		t.Fatalf("expected update to succeed, got %v", err)
	}

	if updatedUser.FirstName != "Johnny" || updatedUser.LastName != "Smith" {
		t.Errorf("expected name Johnny Smith, got %s %s", updatedUser.FirstName, updatedUser.LastName)
	}
	if updatedUser.PhoneNumber == nil || *updatedUser.PhoneNumber != "0898765432" {
		t.Errorf("expected phone 0898765432, got %v", updatedUser.PhoneNumber)
	}
}

func TestUpdateProfile_DuplicatePhoneError(t *testing.T) {
	user1ID := uuid.New()
	user2ID := uuid.New()
	phone1 := "0811111111"
	phone2 := "0822222222"

	repo := &mockUserRepo{
		users: map[uuid.UUID]*models.User{
			user1ID: {ID: user1ID, Username: "u1", FirstName: "User", LastName: "One", PhoneNumber: &phone1},
			user2ID: {ID: user2ID, Username: "u2", FirstName: "User", LastName: "Two", PhoneNumber: &phone2},
		},
	}

	cfg := &config.Config{}
	uc := usecases.NewUserUsecase(cfg, repo, nil)

	// Attempt to change user2 phone to user1 phone
	req := &models.UpdateProfileRequest{
		FirstName:   "User",
		LastName:    "Two",
		PhoneNumber: &phone1,
	}

	_, err := uc.UpdateProfile(user2ID, req)
	if err == nil {
		t.Fatalf("expected duplicate phone error, got nil")
	}
}

func TestChangePassword_Success(t *testing.T) {
	userID := uuid.New()
	oldPass := "oldPassword123"
	oldHash, _ := bcrypt.GenerateFromPassword([]byte(oldPass), bcrypt.DefaultCost)

	initialUser := &models.User{
		ID:           userID,
		Username:     "johndoe",
		PasswordHash: string(oldHash),
	}

	repo := &mockUserRepo{
		users: map[uuid.UUID]*models.User{userID: initialUser},
	}

	cfg := &config.Config{}
	uc := usecases.NewUserUsecase(cfg, repo, nil)

	req := &models.ChangePasswordRequest{
		OldPassword:     "oldPassword123",
		NewPassword:     "newSecurePass456",
		ConfirmPassword: "newSecurePass456",
	}

	err := uc.ChangePassword(userID, req)
	if err != nil {
		t.Fatalf("expected change password to succeed, got %v", err)
	}

	// Verify new hash matches new password
	updatedUser, _ := repo.GetUserByID(userID)
	err = bcrypt.CompareHashAndPassword([]byte(updatedUser.PasswordHash), []byte("newSecurePass456"))
	if err != nil {
		t.Fatalf("new password hash does not match new password: %v", err)
	}
}

func TestChangePassword_InvalidOldPassword(t *testing.T) {
	userID := uuid.New()
	oldPass := "oldPassword123"
	oldHash, _ := bcrypt.GenerateFromPassword([]byte(oldPass), bcrypt.DefaultCost)

	initialUser := &models.User{
		ID:           userID,
		Username:     "johndoe",
		PasswordHash: string(oldHash),
	}

	repo := &mockUserRepo{
		users: map[uuid.UUID]*models.User{userID: initialUser},
	}

	cfg := &config.Config{}
	uc := usecases.NewUserUsecase(cfg, repo, nil)

	req := &models.ChangePasswordRequest{
		OldPassword:     "wrongOldPassword",
		NewPassword:     "newSecurePass456",
		ConfirmPassword: "newSecurePass456",
	}

	err := uc.ChangePassword(userID, req)
	if err == nil {
		t.Fatalf("expected error on incorrect old password, got nil")
	}
}

func TestSetPin_Success(t *testing.T) {
	userID := uuid.New()
	pass := "myPassword123"
	passHash, _ := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)

	initialUser := &models.User{
		ID:           userID,
		Username:     "johndoe",
		PasswordHash: string(passHash),
	}

	repo := &mockUserRepo{
		users: map[uuid.UUID]*models.User{userID: initialUser},
	}

	cfg := &config.Config{}
	uc := usecases.NewUserUsecase(cfg, repo, nil)

	req := &models.SetPinRequest{
		Password:   "myPassword123",
		PIN:        "123456",
		ConfirmPIN: "123456",
	}

	err := uc.SetPin(userID, req)
	if err != nil {
		t.Fatalf("expected SetPin to succeed, got %v", err)
	}

	user, _ := repo.GetUserByID(userID)
	if user.PinHash == nil {
		t.Fatalf("expected PinHash to be set")
	}

	err = bcrypt.CompareHashAndPassword([]byte(*user.PinHash), []byte("123456"))
	if err != nil {
		t.Fatalf("stored PIN hash did not match 123456: %v", err)
	}
}

func TestVerifyPin_SuccessAndFailure(t *testing.T) {
	userID := uuid.New()
	pin := "654321"
	pinHash, _ := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	pinHashStr := string(pinHash)

	initialUser := &models.User{
		ID:      userID,
		PinHash: &pinHashStr,
	}

	repo := &mockUserRepo{
		users: map[uuid.UUID]*models.User{userID: initialUser},
	}

	cfg := &config.Config{}
	uc := usecases.NewUserUsecase(cfg, repo, nil)

	// 1. Correct PIN
	err := uc.VerifyPin(userID, "654321")
	if err != nil {
		t.Fatalf("expected VerifyPin to succeed for 654321, got %v", err)
	}

	// 2. Incorrect PIN
	err = uc.VerifyPin(userID, "000000")
	if err == nil {
		t.Fatalf("expected error for incorrect PIN")
	}

	user, _ := repo.GetUserByID(userID)
	if user.PinFailedAttempts != 1 {
		t.Errorf("expected 1 failed attempt, got %d", user.PinFailedAttempts)
	}

	// 3. Lock after 5 attempts
	user.PinFailedAttempts = 5
	err = uc.VerifyPin(userID, "654321")
	if err == nil || err.Error() == "" {
		t.Fatalf("expected PIN locked error when attempts >= 5")
	}
}

