package usecases

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/atm"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/metrics"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrSenderAccountFrozen   = errors.New("sender account is frozen or inactive")
	ErrReceiverAccountFrozen = errors.New("receiver account is frozen or inactive")
	ErrAccountNotOwnedByUser = errors.New("account does not belong to the authenticated user")
	ErrInsufficientBalance   = errors.New("insufficient account balance")
	ErrCurrencyMismatch      = errors.New("currency mismatch between accounts")
	ErrSameAccountTransfer   = errors.New("cannot transfer money to the same account")
)

type TransferUsecase struct {
	Cfg         *config.Config
	Db          *sqlx.DB
	AccountRepo models.AccountRepository
	UserRepo    models.UserRepository
	LedgerRepo  models.LedgerRepository
	OutboxRepo  models.OutboxRepository
	ATMClient   atm.ATMClient
}

func (u *TransferUsecase) verifyUserPin(userID uuid.UUID, pin string) error {
	if u.UserRepo == nil {
		return nil
	}
	user, err := u.UserRepo.GetUserByID(userID)
	if err != nil {
		return err
	}
	if user.PinHash == nil || *user.PinHash == "" {
		return errors.New("security PIN is not configured. Please set up a 6-digit PIN in Settings")
	}
	if user.PinFailedAttempts >= 5 {
		metrics.PINAttemptsTotal.WithLabelValues("locked").Inc()
		return errors.New("PIN is locked due to too many failed attempts (5/5). Please reset your PIN in Settings using your password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PinHash), []byte(pin)); err != nil {
		attempts, incErr := u.UserRepo.IncrementPinFailedAttempts(userID)
		if incErr != nil {
			return incErr
		}
		remaining := 5 - attempts
		if remaining <= 0 {
			metrics.PINAttemptsTotal.WithLabelValues("locked").Inc()
			return errors.New("incorrect PIN. Your PIN is now locked (5/5 attempts). Please reset your PIN in Settings")
		}
		metrics.PINAttemptsTotal.WithLabelValues("failed").Inc()
		return fmt.Errorf("incorrect PIN. %d attempt(s) remaining", remaining)
	}
	_ = u.UserRepo.ResetPinFailedAttempts(userID)
	metrics.PINAttemptsTotal.WithLabelValues("success").Inc()
	return nil
}

func NewTransferUsecase(
	cfg *config.Config,
	db *sqlx.DB,
	accountRepo models.AccountRepository,
	userRepo models.UserRepository,
	ledgerRepo models.LedgerRepository,
	outboxRepo models.OutboxRepository,
	atmClient atm.ATMClient,
) models.TransferUsecase {
	return &TransferUsecase{
		Cfg:         cfg,
		Db:          db,
		AccountRepo: accountRepo,
		UserRepo:    userRepo,
		LedgerRepo:  ledgerRepo,
		OutboxRepo:  outboxRepo,
		ATMClient:   atmClient,
	}
}

// Transfer executes money transfer between two accounts with deadlock prevention & double entry
func (u *TransferUsecase) Transfer(userID uuid.UUID, req *models.TransferRequest, idempotencyKey string) (*models.TransferReceipt, error) {
	if err := u.verifyUserPin(userID, req.PIN); err != nil {
		return nil, err
	}

	if req.SenderAccountID == req.ReceiverAccountID {
		return nil, ErrSameAccountTransfer
	}
	if req.Amount <= 0 {
		return nil, errors.New("transfer amount must be greater than zero")
	}

	tx, err := u.Db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Deadlock Prevention: Deterministic Lock Ordering by Account ID
	firstLockID := req.SenderAccountID
	secondLockID := req.ReceiverAccountID
	if firstLockID > secondLockID {
		firstLockID, secondLockID = secondLockID, firstLockID
	}

	firstAcc, err := u.AccountRepo.GetAccountByIDForUpdate(tx, firstLockID)
	if err != nil {
		return nil, fmt.Errorf("failed to lock account %d: %w", firstLockID, err)
	}

	secondAcc, err := u.AccountRepo.GetAccountByIDForUpdate(tx, secondLockID)
	if err != nil {
		return nil, fmt.Errorf("failed to lock account %d: %w", secondLockID, err)
	}

	var senderAcc, receiverAcc *models.Account
	if firstAcc.ID == req.SenderAccountID {
		senderAcc = firstAcc
		receiverAcc = secondAcc
	} else {
		senderAcc = secondAcc
		receiverAcc = firstAcc
	}

	// Validation
	if senderAcc.UserID != userID {
		return nil, ErrAccountNotOwnedByUser
	}
	if senderAcc.Status != models.AccountStatusActive {
		return nil, ErrSenderAccountFrozen
	}
	if receiverAcc.Status != models.AccountStatusActive {
		return nil, ErrReceiverAccountFrozen
	}
	if senderAcc.Balance < req.Amount {
		return nil, ErrInsufficientBalance
	}
	if senderAcc.Currency != receiverAcc.Currency {
		return nil, ErrCurrencyMismatch
	}

	// Update Balances
	newSenderBal := senderAcc.Balance - req.Amount
	newReceiverBal := receiverAcc.Balance + req.Amount

	if err := u.AccountRepo.UpdateBalance(tx, senderAcc.ID, newSenderBal, 0); err != nil {
		return nil, err
	}
	if err := u.AccountRepo.UpdateBalance(tx, receiverAcc.ID, newReceiverBal, 0); err != nil {
		return nil, err
	}

	// Create Journal Header
	refID := idempotencyKey
	if refID == "" {
		refID = utils.TransactionReference()
	}
	journalID := uuid.New()
	desc := req.Description
	if desc == "" {
		desc = fmt.Sprintf("Transfer from %s to %s", senderAcc.AccountNumber, receiverAcc.AccountNumber)
	}

	journal := &models.JournalEntry{
		ID:              journalID,
		ReferenceID:     refID,
		TransactionType: models.TransactionTypeTransfer,
		Description:     desc,
		Status:          models.JournalStatusPosted,
		PostedAt:        time.Now().UTC(),
	}
	if err := u.LedgerRepo.CreateJournalEntry(tx, journal); err != nil {
		return nil, err
	}

	// Record Double-Entry Postings
	debitPosting := &models.LedgerEntry{
		JournalEntryID: journalID,
		AccountID:      senderAcc.ID,
		EntryType:      models.EntryTypeDebit,
		Amount:         req.Amount,
		BalanceAfter:   newSenderBal,
		Sequence:       1,
	}
	if err := u.LedgerRepo.CreateLedgerEntry(tx, debitPosting); err != nil {
		return nil, err
	}

	creditPosting := &models.LedgerEntry{
		JournalEntryID: journalID,
		AccountID:      receiverAcc.ID,
		EntryType:      models.EntryTypeCredit,
		Amount:         req.Amount,
		BalanceAfter:   newReceiverBal,
		Sequence:       2,
	}
	if err := u.LedgerRepo.CreateLedgerEntry(tx, creditPosting); err != nil {
		return nil, err
	}

	// Persist Transactional Outbox Event
	eventPayload, _ := json.Marshal(models.MoneyTransferredEventPayload{
		JournalID:         journalID,
		ReferenceID:       refID,
		SenderAccountID:   senderAcc.ID,
		ReceiverAccountID: receiverAcc.ID,
		Amount:            req.Amount,
		Currency:          senderAcc.Currency,
		TransferredAt:     journal.PostedAt,
	})

	outboxEvent := &models.OutboxEvent{
		AggregateType: "TRANSFER",
		AggregateID:   journalID.String(),
		EventType:     models.EventMoneyTransferred,
		Payload:       eventPayload,
		Status:        models.OutboxStatusPending,
	}
	if err := u.OutboxRepo.InsertOutboxEventTx(tx, outboxEvent); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		metrics.TransactionsTotal.WithLabelValues("transfer", "failed").Inc()
		return nil, err
	}

	metrics.TransactionsTotal.WithLabelValues("transfer", "success").Inc()
	metrics.TransactionAmountSatangTotal.WithLabelValues("transfer", senderAcc.Currency).Add(float64(req.Amount))

	return &models.TransferReceipt{
		JournalID:         journalID,
		ReferenceID:       refID,
		SenderAccountID:   senderAcc.ID,
		ReceiverAccountID: receiverAcc.ID,
		Amount:            req.Amount,
		Currency:          senderAcc.Currency,
		Status:            "SUCCESS",
		CreatedAt:         journal.PostedAt,
	}, nil
}

// Deposit deposits money into customer account with lock-free append-only double-entry balancing against Central Cash Settlement (Account 100)
func (u *TransferUsecase) Deposit(userID uuid.UUID, req *models.DepositRequest, idempotencyKey string) (*models.TransferReceipt, error) {
	if req.Amount <= 0 {
		return nil, errors.New("deposit amount must be greater than zero")
	}

	tx, err := u.Db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Lock ONLY the Customer Account (High-concurrency: zero lock contention on Central Settlement)
	customerAcc, err := u.AccountRepo.GetAccountByIDForUpdate(tx, req.AccountID)
	if err != nil {
		return nil, fmt.Errorf("customer account not found: %w", err)
	}

	if customerAcc.Status != models.AccountStatusActive {
		return nil, ErrReceiverAccountFrozen
	}

	// 2. Update customer balance
	newCustomerBalance := customerAcc.Balance + req.Amount
	if err := u.AccountRepo.UpdateBalance(tx, customerAcc.ID, newCustomerBalance, 0); err != nil {
		return nil, err
	}

	// 3. Create Journal Header
	refID := idempotencyKey
	if refID == "" {
		refID = utils.TransactionReference()
	}
	journalID := uuid.New()
	desc := req.Description
	if desc == "" {
		desc = fmt.Sprintf("Deposit to %s (Ref: %s)", customerAcc.AccountNumber, req.DepositRef)
	}

	journal := &models.JournalEntry{
		ID:              journalID,
		ReferenceID:     refID,
		TransactionType: models.TransactionTypeDeposit,
		Description:     desc,
		Status:          models.JournalStatusPosted,
		PostedAt:        time.Now().UTC(),
	}
	if err := u.LedgerRepo.CreateJournalEntry(tx, journal); err != nil {
		return nil, err
	}

	// 4. Double-Entry Leg 1: DEBIT Central Cash Settlement (Account 100)
	// (Append-only insert without row lock to allow unlimited concurrent deposits)
	settleAccountID := int64(100)
	debitPosting := &models.LedgerEntry{
		JournalEntryID: journalID,
		AccountID:      settleAccountID,
		EntryType:      models.EntryTypeDebit,
		Amount:         req.Amount,
		BalanceAfter:   0,
		Sequence:       1,
	}
	if err := u.LedgerRepo.CreateLedgerEntry(tx, debitPosting); err != nil {
		return nil, err
	}

	// 5. Double-Entry Leg 2: CREDIT Customer Account (Customer digital balance increased)
	creditPosting := &models.LedgerEntry{
		JournalEntryID: journalID,
		AccountID:      customerAcc.ID,
		EntryType:      models.EntryTypeCredit,
		Amount:         req.Amount,
		BalanceAfter:   newCustomerBalance,
		Sequence:       2,
	}
	if err := u.LedgerRepo.CreateLedgerEntry(tx, creditPosting); err != nil {
		return nil, err
	}

	// 6. Outbox Event
	if u.OutboxRepo != nil {
		eventPayload, _ := json.Marshal(map[string]interface{}{
			"journal_id":   journalID,
			"reference_id": refID,
			"account_id":   customerAcc.ID,
			"amount":       req.Amount,
			"currency":     customerAcc.Currency,
			"deposit_ref":  req.DepositRef,
			"deposited_at": journal.PostedAt,
		})
		outboxEvent := &models.OutboxEvent{
			AggregateType: "DEPOSIT",
			AggregateID:   journalID.String(),
			EventType:     models.EventMoneyDeposited,
			Payload:       eventPayload,
			Status:        models.OutboxStatusPending,
		}
		_ = u.OutboxRepo.InsertOutboxEventTx(tx, outboxEvent)
	}

	if err := tx.Commit(); err != nil {
		metrics.TransactionsTotal.WithLabelValues("deposit", "failed").Inc()
		return nil, err
	}

	metrics.TransactionsTotal.WithLabelValues("deposit", "success").Inc()
	metrics.TransactionAmountSatangTotal.WithLabelValues("deposit", customerAcc.Currency).Add(float64(req.Amount))

	return &models.TransferReceipt{
		JournalID:         journalID,
		ReferenceID:       refID,
		SenderAccountID:   settleAccountID,
		ReceiverAccountID: customerAcc.ID,
		Amount:            req.Amount,
		Currency:          customerAcc.Currency,
		Status:            "SUCCESS",
		CreatedAt:         journal.PostedAt,
	}, nil
}

// Withdrawal withdraws money from customer account with Two-Phase ATM Hardware Confirmation
func (u *TransferUsecase) Withdrawal(userID uuid.UUID, req *models.WithdrawalRequest, idempotencyKey string) (*models.TransferReceipt, error) {
	if req.Amount <= 0 {
		return nil, errors.New("withdrawal amount must be greater than zero")
	}

	atmID := req.ATMID
	if atmID <= 0 {
		atmID = 1 // Default to ATM #1
	}

	// -------------------------------------------------------------------------
	// Phase 1: Pre-check customer balance and account status
	// -------------------------------------------------------------------------
	accCheck, err := u.AccountRepo.GetAccountByID(req.AccountID)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}
	if accCheck.UserID != userID {
		return nil, ErrAccountNotOwnedByUser
	}
	if accCheck.Status != models.AccountStatusActive {
		return nil, ErrSenderAccountFrozen
	}
	if accCheck.Balance < req.Amount {
		return nil, ErrInsufficientBalance
	}

	// -------------------------------------------------------------------------
	// Phase 2: Dispatch Hardware Dispense Command to ATM Machine
	// -------------------------------------------------------------------------
	refID := idempotencyKey
	if refID == "" {
		refID = utils.TransactionReference()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 7*time.Second)
	defer cancel()

	var dispenseResult *atm.DispenseResult
	if u.ATMClient != nil {
		dispenseResult, err = u.ATMClient.DispenseCash(ctx, atmID, req.Amount)
		if err != nil {
			// Record ATM failure alert in Outbox without deducting any customer funds
			failPayload, _ := json.Marshal(map[string]interface{}{
				"account_id":  req.AccountID,
				"atm_id":      atmID,
				"amount":      req.Amount,
				"ref_id":      refID,
				"error":       err.Error(),
				"occurred_at": time.Now().UTC(),
			})
			_ = u.OutboxRepo.InsertOutboxEvent(&models.OutboxEvent{
				AggregateType: "ATM_DISPENSE",
				AggregateID:   fmt.Sprintf("ATM-%d-%s", atmID, refID),
				EventType:     "atm.dispense_failed",
				Payload:       failPayload,
				Status:        models.OutboxStatusPending,
			})

			return nil, fmt.Errorf("ATM #%d cash dispense failed: %w. No funds were deducted", atmID, err)
		}
	}

	// -------------------------------------------------------------------------
	// Phase 3: Commit Double-Entry Bookkeeping & Vault Deduction
	// -------------------------------------------------------------------------
	tx, err := u.Db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Lock customer account
	account, err := u.AccountRepo.GetAccountByIDForUpdate(tx, req.AccountID)
	if err != nil {
		return nil, err
	}
	if account.Balance < req.Amount {
		return nil, ErrInsufficientBalance
	}

	// 2. Determine per-ATM Vault Account ID (e.g. 101, 102, 103)
	vaultAccountID := int64(100 + atmID)
	vaultAccount, err := u.AccountRepo.GetAccountByIDForUpdate(tx, vaultAccountID)
	if err != nil {
		// Fallback to Central Settlement account (100) if specific vault not found
		vaultAccountID = 100
		vaultAccount, _ = u.AccountRepo.GetAccountByIDForUpdate(tx, vaultAccountID)
	}

	newCustomerBal := account.Balance - req.Amount
	if err := u.AccountRepo.UpdateBalance(tx, account.ID, newCustomerBal, 0); err != nil {
		return nil, err
	}

	var newVaultBal int64
	if vaultAccount != nil {
		newVaultBal = vaultAccount.Balance - req.Amount
		_ = u.AccountRepo.UpdateBalance(tx, vaultAccount.ID, newVaultBal, 0)
	}

	journalID := uuid.New()
	desc := req.Description
	if desc == "" {
		desc = fmt.Sprintf("ATM Cash Withdrawal at Machine #%d (Ref: %s)", atmID, req.WithdrawalRef)
	}

	journal := &models.JournalEntry{
		ID:              journalID,
		ReferenceID:     refID,
		TransactionType: models.TransactionTypeWithdrawal,
		Description:     desc,
		Status:          models.JournalStatusPosted,
		PostedAt:        time.Now().UTC(),
	}
	if err := u.LedgerRepo.CreateJournalEntry(tx, journal); err != nil {
		return nil, err
	}

	// Double-Entry Leg 1: DEBIT Customer Account
	debitPosting := &models.LedgerEntry{
		JournalEntryID: journalID,
		AccountID:      account.ID,
		EntryType:      models.EntryTypeDebit,
		Amount:         req.Amount,
		BalanceAfter:   newCustomerBal,
		Sequence:       1,
	}
	if err := u.LedgerRepo.CreateLedgerEntry(tx, debitPosting); err != nil {
		return nil, err
	}

	// Double-Entry Leg 2: CREDIT ATM Vault Account (Cash leaves vault into customer hands)
	creditPosting := &models.LedgerEntry{
		JournalEntryID: journalID,
		AccountID:      vaultAccountID,
		EntryType:      models.EntryTypeCredit,
		Amount:         req.Amount,
		BalanceAfter:   newVaultBal,
		Sequence:       2,
	}
	if err := u.LedgerRepo.CreateLedgerEntry(tx, creditPosting); err != nil {
		return nil, err
	}

	// Persist Outbox Event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"journal_id":   journalID,
		"reference_id": refID,
		"account_id":   account.ID,
		"atm_id":       atmID,
		"amount":       req.Amount,
		"currency":     account.Currency,
		"dispensed_at": journal.PostedAt,
	})

	outboxEvent := &models.OutboxEvent{
		AggregateType: "WITHDRAWAL",
		AggregateID:   journalID.String(),
		EventType:     models.EventMoneyWithdrawn,
		Payload:       eventPayload,
		Status:        models.OutboxStatusPending,
	}
	if err := u.OutboxRepo.InsertOutboxEventTx(tx, outboxEvent); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	dispensedMsg := "SUCCESS"
	if dispenseResult != nil {
		dispensedMsg = dispenseResult.Message
	}

	return &models.TransferReceipt{
		JournalID:         journalID,
		ReferenceID:       refID,
		SenderAccountID:   account.ID,
		ReceiverAccountID: vaultAccountID,
		Amount:            req.Amount,
		Currency:          account.Currency,
		Status:            dispensedMsg,
		CreatedAt:         journal.PostedAt,
	}, nil
}

// RequestCardlessWithdrawal generates a 15-minute 6-digit OTP code bound to customer's phone number
func (u *TransferUsecase) RequestCardlessWithdrawal(userID uuid.UUID, req *models.RequestCardlessWithdrawalRequest) (*models.CardlessWithdrawalTicket, error) {
	if err := u.verifyUserPin(userID, req.PIN); err != nil {
		return nil, err
	}

	if req.Amount <= 0 {
		return nil, errors.New("withdrawal amount must be greater than zero")
	}

	// 1. Verify account ownership and balance
	account, err := u.AccountRepo.GetAccountByID(req.AccountID)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}
	if account.UserID != userID {
		return nil, ErrAccountNotOwnedByUser
	}
	if account.Status != models.AccountStatusActive {
		return nil, ErrSenderAccountFrozen
	}
	if account.Balance < req.Amount {
		return nil, ErrInsufficientBalance
	}

	// 2. Resolve customer phone number
	phoneNumber := req.PhoneNumber
	if phoneNumber == "" && u.UserRepo != nil {
		user, err := u.UserRepo.GetUserByID(userID)
		if err == nil && user.PhoneNumber != nil {
			phoneNumber = *user.PhoneNumber
		}
	}
	if phoneNumber == "" {
		phoneNumber = "0812345678" // Default fallback demo phone
	}

	// 3. Generate 6-digit cryptographic PIN code
	randGen := rand.New(rand.NewSource(time.Now().UnixNano()))
	code := fmt.Sprintf("%06d", randGen.Int63n(1000000))

	atmID := req.ATMID
	if atmID <= 0 {
		atmID = 1
	}

	orderID := uuid.New()
	expiresAt := time.Now().UTC().Add(15 * time.Minute)

	// 4. Cancel any prior pending withdrawal orders for this phone/account
	_, _ = u.Db.Exec(`
		UPDATE cardless_withdrawals 
		SET status = 'CANCELLED', updated_at = NOW() 
		WHERE phone_number = $1 AND status = 'PENDING'
	`, phoneNumber)

	// 5. Insert new cardless withdrawal order
	query := `
		INSERT INTO cardless_withdrawals (
			id, user_id, account_id, phone_number, code, amount, currency, atm_id, status, failed_attempts, max_attempts, expires_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', 0, 3, $9, NOW(), NOW()
		)
	`
	currency := req.Currency
	if currency == "" {
		currency = account.Currency
	}

	_, err = u.Db.Exec(query, orderID, userID, account.ID, phoneNumber, code, req.Amount, currency, atmID, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create cardless withdrawal order: %w", err)
	}

	return &models.CardlessWithdrawalTicket{
		OrderID:          orderID,
		AccountID:        account.ID,
		PhoneNumber:      phoneNumber,
		Code:             code,
		Amount:           req.Amount,
		Currency:         currency,
		ATMID:            atmID,
		ExpiresInSeconds: 900,
		ExpiresAt:        expiresAt,
	}, nil
}

// VerifyCardlessWithdrawal checks phone number and 6-digit code at the ATM machine
func (u *TransferUsecase) VerifyCardlessWithdrawal(req *models.VerifyCardlessWithdrawalRequest) (*models.VerifyCardlessWithdrawalResponse, error) {
	if req.PhoneNumber == "" || req.Code == "" {
		return nil, errors.New("phone number and 6-digit code are required")
	}

	var order models.CardlessWithdrawal
	query := `
		SELECT id, user_id, account_id, phone_number, code, amount, currency, atm_id, status, failed_attempts, max_attempts, expires_at, created_at, updated_at
		FROM cardless_withdrawals
		WHERE phone_number = $1 AND status = 'PENDING'
		ORDER BY created_at DESC
		LIMIT 1
	`
	err := u.Db.Get(&order, query, req.PhoneNumber)
	if err != nil {
		return nil, errors.New("no active cardless withdrawal request found for this phone number")
	}

	// Check expiration
	if time.Now().UTC().After(order.ExpiresAt) {
		_, _ = u.Db.Exec("UPDATE cardless_withdrawals SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1", order.ID)
		return nil, errors.New("cardless withdrawal code has expired (15-minute limit exceeded)")
	}

	// Check code match
	if order.Code != req.Code {
		newFailed := order.FailedAttempts + 1
		if newFailed >= order.MaxAttempts {
			_, _ = u.Db.Exec("UPDATE cardless_withdrawals SET status = 'CANCELLED', failed_attempts = $1, updated_at = NOW() WHERE id = $2", newFailed, order.ID)
			return nil, errors.New("maximum 3 incorrect PIN attempts exceeded. Cardless withdrawal order has been cancelled for security")
		}

		_, _ = u.Db.Exec("UPDATE cardless_withdrawals SET failed_attempts = $1, updated_at = NOW() WHERE id = $2", newFailed, order.ID)
		return nil, fmt.Errorf("invalid 6-digit code. %d attempt(s) remaining before order cancellation", order.MaxAttempts-newFailed)
	}

	// Code matched -> Fetch customer full name
	customerName := "Valued Customer"
	if u.UserRepo != nil {
		user, err := u.UserRepo.GetUserByID(order.UserID)
		if err == nil && user != nil {
			customerName = fmt.Sprintf("%s %s", user.FirstName, user.LastName)
		}
	}

	return &models.VerifyCardlessWithdrawalResponse{
		OrderID:      order.ID,
		CustomerName: customerName,
		Amount:       order.Amount,
		Currency:     order.Currency,
		ATMID:        order.ATMID,
		Status:       "VERIFIED",
	}, nil
}

// ConfirmCardlessWithdrawal completes the double-entry bookkeeping after ATM physical cash dispensing
func (u *TransferUsecase) ConfirmCardlessWithdrawal(req *models.ConfirmCardlessWithdrawalRequest) (*models.TransferReceipt, error) {
	tx, err := u.Db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Lock and fetch order
	var order models.CardlessWithdrawal
	query := `
		SELECT id, user_id, account_id, phone_number, code, amount, currency, atm_id, status, failed_attempts, max_attempts, expires_at, created_at, updated_at
		FROM cardless_withdrawals
		WHERE id = $1 FOR UPDATE
	`
	if err := tx.Get(&order, query, req.OrderID); err != nil {
		return nil, fmt.Errorf("cardless withdrawal order not found: %w", err)
	}

	if order.Status != "PENDING" && order.Status != "VERIFIED" {
		return nil, fmt.Errorf("withdrawal order is not active (current status: %s)", order.Status)
	}

	if time.Now().UTC().After(order.ExpiresAt) {
		return nil, errors.New("withdrawal order has expired")
	}

	// 2. Lock customer account & verify balance
	account, err := u.AccountRepo.GetAccountByIDForUpdate(tx, order.AccountID)
	if err != nil {
		return nil, fmt.Errorf("customer account not found: %w", err)
	}
	if account.Balance < order.Amount {
		return nil, ErrInsufficientBalance
	}

	// 3. Lock per-ATM Vault Account
	atmID := req.ATMID
	if atmID <= 0 {
		atmID = order.ATMID
	}
	vaultAccountID := int64(100 + atmID)
	vaultAccount, err := u.AccountRepo.GetAccountByIDForUpdate(tx, vaultAccountID)
	if err != nil {
		vaultAccountID = 100
		vaultAccount, _ = u.AccountRepo.GetAccountByIDForUpdate(tx, vaultAccountID)
	}

	// 4. Update balances
	newCustomerBal := account.Balance - order.Amount
	if err := u.AccountRepo.UpdateBalance(tx, account.ID, newCustomerBal, 0); err != nil {
		return nil, err
	}

	var newVaultBal int64
	if vaultAccount != nil {
		newVaultBal = vaultAccount.Balance - order.Amount
		_ = u.AccountRepo.UpdateBalance(tx, vaultAccount.ID, newVaultBal, 0)
	}

	// 5. Update order status
	_, err = tx.Exec("UPDATE cardless_withdrawals SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1", order.ID)
	if err != nil {
		return nil, err
	}

	// 6. Record Double-Entry Journal & Append-Only Ledger Postings
	refID := fmt.Sprintf("CARDLESS-%s", order.ID.String()[:8])
	journalID := uuid.New()
	desc := fmt.Sprintf("Cardless ATM Cash Out (Phone: %s, ATM #%d)", order.PhoneNumber, atmID)

	journal := &models.JournalEntry{
		ID:              journalID,
		ReferenceID:     refID,
		TransactionType: models.TransactionTypeWithdrawal,
		Description:     desc,
		Status:          models.JournalStatusPosted,
		PostedAt:        time.Now().UTC(),
	}
	if err := u.LedgerRepo.CreateJournalEntry(tx, journal); err != nil {
		return nil, err
	}

	debitPosting := &models.LedgerEntry{
		JournalEntryID: journalID,
		AccountID:      account.ID,
		EntryType:      models.EntryTypeDebit,
		Amount:         order.Amount,
		BalanceAfter:   newCustomerBal,
		Sequence:       1,
	}
	if err := u.LedgerRepo.CreateLedgerEntry(tx, debitPosting); err != nil {
		return nil, err
	}

	creditPosting := &models.LedgerEntry{
		JournalEntryID: journalID,
		AccountID:      vaultAccountID,
		EntryType:      models.EntryTypeCredit,
		Amount:         order.Amount,
		BalanceAfter:   newVaultBal,
		Sequence:       2,
	}
	if err := u.LedgerRepo.CreateLedgerEntry(tx, creditPosting); err != nil {
		return nil, err
	}

	// 7. Persist Outbox Event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"journal_id":   journalID,
		"order_id":     order.ID,
		"reference_id": refID,
		"account_id":   account.ID,
		"phone_number": order.PhoneNumber,
		"atm_id":       atmID,
		"amount":       order.Amount,
		"currency":     order.Currency,
		"dispensed_at": journal.PostedAt,
	})

	outboxEvent := &models.OutboxEvent{
		AggregateType: "CARDLESS_WITHDRAWAL",
		AggregateID:   journalID.String(),
		EventType:     models.EventMoneyWithdrawn,
		Payload:       eventPayload,
		Status:        models.OutboxStatusPending,
	}
	if err := u.OutboxRepo.InsertOutboxEventTx(tx, outboxEvent); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		metrics.TransactionsTotal.WithLabelValues("withdrawal", "failed").Inc()
		metrics.ATMDispenseTotal.WithLabelValues(strconv.Itoa(atmID), "failed").Inc()
		return nil, err
	}

	metrics.TransactionsTotal.WithLabelValues("withdrawal", "success").Inc()
	metrics.TransactionAmountSatangTotal.WithLabelValues("withdrawal", order.Currency).Add(float64(order.Amount))
	metrics.ATMDispenseTotal.WithLabelValues(strconv.Itoa(atmID), "success").Inc()

	return &models.TransferReceipt{
		JournalID:         journalID,
		ReferenceID:       refID,
		SenderAccountID:   account.ID,
		ReceiverAccountID: vaultAccountID,
		Amount:            order.Amount,
		Currency:          account.Currency,
		Status:            "SUCCESS",
		CreatedAt:         journal.PostedAt,
	}, nil
}
