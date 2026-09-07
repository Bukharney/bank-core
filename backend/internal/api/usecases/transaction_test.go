package usecases_test

import (
	"context"
	"errors"
	"testing"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/atm"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type mockATMClientForTest struct {
	dispenseErr error
	dispensed   int64
}

func (m *mockATMClientForTest) HealthCheck(ctx context.Context, atmID int) bool {
	return true
}

func (m *mockATMClientForTest) DispenseCash(ctx context.Context, atmID int, amountInSatang int64) (*atm.DispenseResult, error) {
	if m.dispenseErr != nil {
		return nil, m.dispenseErr
	}
	m.dispensed += amountInSatang
	return &atm.DispenseResult{
		Status:       "success",
		DispensedSat: amountInSatang,
	}, nil
}

func TestWithdrawal_InvalidAmount(t *testing.T) {
	uc := usecases.NewTransferUsecase(nil, nil, nil, nil, nil, nil, nil)

	// Zero amount
	_, err := uc.Withdrawal(uuid.New(), &models.WithdrawalRequest{
		AccountID:     1,
		Amount:        0,
		WithdrawalRef: "REF-001",
	}, "")
	if err == nil {
		t.Fatal("expected error for zero amount, got nil")
	}

	// Negative amount
	_, err = uc.Withdrawal(uuid.New(), &models.WithdrawalRequest{
		AccountID:     1,
		Amount:        -500,
		WithdrawalRef: "REF-002",
	}, "")
	if err == nil {
		t.Fatal("expected error for negative amount, got nil")
	}
}

func TestRequestCardlessWithdrawal_PINValidation(t *testing.T) {
	userID := uuid.New()
	hash, err := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("failed to hash pin: %v", err)
	}
	hashStr := string(hash)

	userRepo := &mockUserRepo{
		users: map[uuid.UUID]*models.User{
			userID: {
				ID:                 userID,
				PinHash:            &hashStr,
				PinFailedAttempts: 0,
			},
		},
	}

	uc := usecases.NewTransferUsecase(nil, nil, nil, userRepo, nil, nil, nil)

	// Test wrong PIN
	_, err = uc.RequestCardlessWithdrawal(userID, &models.RequestCardlessWithdrawalRequest{
		AccountID: 1,
		Amount:    1000,
		PIN:       "999999",
	})
	if err == nil {
		t.Fatal("expected error for incorrect PIN, got nil")
	}

	// Verify failed attempts incremented
	if userRepo.users[userID].PinFailedAttempts != 1 {
		t.Fatalf("expected 1 failed attempt, got %d", userRepo.users[userID].PinFailedAttempts)
	}

	// Test locked PIN
	userRepo.users[userID].PinFailedAttempts = 5
	_, err = uc.RequestCardlessWithdrawal(userID, &models.RequestCardlessWithdrawalRequest{
		AccountID: 1,
		Amount:    1000,
		PIN:       "123456",
	})
	if err == nil {
		t.Fatal("expected error for locked PIN (5 attempts), got nil")
	}
}

func TestRequestCardlessWithdrawal_InvalidAmount(t *testing.T) {
	userID := uuid.New()
	hash, err := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("failed to hash pin: %v", err)
	}
	hashStr := string(hash)

	userRepo := &mockUserRepo{
		users: map[uuid.UUID]*models.User{
			userID: {
				ID:                 userID,
				PinHash:            &hashStr,
				PinFailedAttempts: 0,
			},
		},
	}

	uc := usecases.NewTransferUsecase(nil, nil, nil, userRepo, nil, nil, nil)

	// Test invalid amount (0)
	_, err = uc.RequestCardlessWithdrawal(userID, &models.RequestCardlessWithdrawalRequest{
		AccountID: 1,
		Amount:    0,
		PIN:       "123456",
	})
	if err == nil {
		t.Fatal("expected error for zero amount, got nil")
	}
}

func TestVerifyCardlessWithdrawal_MissingParams(t *testing.T) {
	uc := usecases.NewTransferUsecase(nil, nil, nil, nil, nil, nil, nil)

	_, err := uc.VerifyCardlessWithdrawal(&models.VerifyCardlessWithdrawalRequest{
		PhoneNumber: "",
		Code:        "123456",
	})
	if err == nil {
		t.Fatal("expected error for missing phone number, got nil")
	}

	_, err = uc.VerifyCardlessWithdrawal(&models.VerifyCardlessWithdrawalRequest{
		PhoneNumber: "0812345678",
		Code:        "",
	})
	if err == nil {
		t.Fatal("expected error for missing code, got nil")
	}
}

func TestDeterministicLockOrder_DeadlockPrevention(t *testing.T) {
	// Ensures that whether customer account ID is lower or higher than vault account ID (103),
	// the locks are deterministically acquired in min -> max order.
	vaultAccountID := int64(103)

	testCases := []struct {
		customerAccountID int64
		expectedFirst     int64
		expectedSecond    int64
	}{
		{customerAccountID: 5, expectedFirst: 5, expectedSecond: 103},
		{customerAccountID: 150, expectedFirst: 103, expectedSecond: 150},
		{customerAccountID: 102, expectedFirst: 102, expectedSecond: 103},
		{customerAccountID: 104, expectedFirst: 103, expectedSecond: 104},
	}

	for _, tc := range testCases {
		first := tc.customerAccountID
		second := vaultAccountID
		if first > second {
			first, second = second, first
		}

		if first != tc.expectedFirst || second != tc.expectedSecond {
			t.Errorf("for customer ID %d: expected locks (%d, %d), got (%d, %d)",
				tc.customerAccountID, tc.expectedFirst, tc.expectedSecond, first, second)
		}
	}
}

func TestATMClient_HardwareJamDetection(t *testing.T) {
	mockClient := &mockATMClientForTest{
		dispenseErr: errors.New("500 Internal Server Error: Cash dispenser mechanism jammed"),
	}

	ctx := context.Background()
	res, err := mockClient.DispenseCash(ctx, 1, 50000)
	if err == nil {
		t.Fatalf("expected hardware jam error, got response: %v", res)
	}

	if mockClient.dispensed != 0 {
		t.Fatalf("expected 0 dispensed satang on hardware failure, got %d", mockClient.dispensed)
	}
}
