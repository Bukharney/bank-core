# Plan 012: ATM Two-Phase Cash Dispense & Machine-to-Machine Authentication

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b6a65fd..HEAD -- backend/internal/api/usecases/transaction.go backend/atm/main.go backend/internal/api/middleware/middleware.go backend/internal/config/config.go`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/010-journal-idor-and-cors-preflight-hardening.md
- **Category**: correctness
- **Planned at**: commit `b6a65fd`, 2026-09-07

## Why this matters

In the current ATM implementation, physical cash is dispensed by the hardware client *before* the bank core database transaction commits the debit. If concurrent requests exhaust the account balance, or if confirmation fails due to network partitions or invalid account states, banknotes have already been physically ejected into customer hands while the database rolls back, creating a severe phantom cash / double-spending risk. Additionally, ATM endpoints (`/transaction/withdraw/verify`, `/transaction/withdraw/confirm`, `/transaction/atm/deposit/lookup`, `/transaction/atm/deposit`) are listed as unauthenticated routes, allowing any caller on port 8080 to trigger cardless confirmations or deposit arbitrary balances without presenting ATM machine credentials. This plan eliminates the phantom dispense race condition and secures all ATM machine-to-machine (M2M) communication.

## Current state

The relevant files and their roles:
- `backend/internal/api/usecases/transaction.go` — contains `Withdrawal` (lines 378–565), `ConfirmCardlessWithdrawal` (lines 710–860), and `ATMDeposit` (lines 915–1050).
- `backend/atm/main.go` — ATM hardware simulator containing `claimCash` (lines 68–164) and `depositCash` (lines 244–329).
- `backend/internal/config/config.go` — configuration loader without `ATMSecret`.
- `backend/internal/api/middleware/middleware.go` — contains `unprotectedRoutes` (lines 18–31) exposing ATM endpoints without M2M auth.

### Current Code Excerpts

`backend/internal/api/usecases/transaction.go:417-458`:
```go
	var dispenseResult *atm.DispenseResult
	if u.ATMClient != nil {
		dispenseResult, err = u.ATMClient.DispenseCash(ctx, atmID, req.Amount)
		if err != nil {
			// Record ATM failure alert in Outbox without deducting any customer funds
			...
			return nil, fmt.Errorf("ATM #%d cash dispense failed: %w. No funds were deducted", atmID, err)
		}
	}

	// Phase 3: Commit Double-Entry Bookkeeping & Vault Deduction
	tx, err := u.Db.Beginx()
	...
	account, err := u.AccountRepo.GetAccountByIDForUpdate(tx, req.AccountID)
	...
	if account.Balance < req.Amount {
		return nil, ErrInsufficientBalance
	}
```

`backend/atm/main.go:135-154`:
```go
	// 2. Physical Dispense Simulation
	units := int(verifyData.Amount / 100)
	if units <= 0 {
		units = 1
	}
	_ = simulateDispense(units)

	// 3. Confirm with Bank Core to commit double-entry bookkeeping
	confirmPayload, _ := json.Marshal(map[string]interface{}{
		"order_id": verifyData.OrderID,
		"atm_id":   atmID,
	})

	confirmResp, err := http.Post(fmt.Sprintf("%s/transaction/withdraw/confirm", getBankCoreURL()), "application/json", bytes.NewReader(confirmPayload))
	if err != nil || confirmResp.StatusCode != http.StatusOK {
		log.Printf("[ATM #%d] Warning: failed to confirm ledger with Bank Core: %v", atmID, err)
	}
```

`backend/internal/api/middleware/middleware.go:27-31`:
```go
	"/transaction/withdraw/verify":  true,
	"/transaction/withdraw/confirm": true,
	"/transaction/atm/deposit/lookup": true,
	"/transaction/atm/deposit":        true,
```

### Repo Conventions to Follow
- Deadlock-free locking: Always sort account IDs and lock smaller ID first (`min(ID)` then `max(ID)`) as documented in `.agents/skills/banking-core-patterns/SKILL.md:43-57`.
- Double-entry accounting: Every ledger mutation must balance debits and credits ($\sum \text{Debit} = \sum \text{Credit}$) with append-only ledger entries.
- Configuration loading: Use `getEnv(key, defaultVal)` in `internal/config/config.go`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Middleware Unit Tests | `cd backend && go test ./internal/api/middleware -v` | `ok ... internal/api/middleware` |
| Usecase Unit Tests | `cd backend && go test ./internal/api/usecases -v` | `ok ... internal/api/usecases` |
| Full Backend Tests | `cd backend && go test ./internal/...` | All packages pass |
| E2E Verification | `powershell -File ./test_e2e.ps1` | `ALL BANK CORE & CARDLESS ATM TESTS PASSED` |

## Scope

**In scope**:
- `backend/internal/config/config.go`
- `backend/internal/api/middleware/middleware.go`
- `backend/internal/api/middleware/middleware_test.go`
- `backend/internal/api/usecases/transaction.go`
- `backend/internal/api/usecases/transaction_test.go` (create)
- `backend/atm/main.go`

**Out of scope**:
- Database schema / table alterations.
- Frontend Next.js UI components.
- Modifying customer-facing JWT auth logic.

## Git workflow

- Branch: `advisor/012-atm-two-phase-dispense-and-m2m-auth`
- Commits: Conventional Commits style
  - `feat(config): add ATMSecret to configuration loader`
  - `feat(middleware): add machine authentication for ATM endpoints`
  - `fix(atm): require Bank Core confirmation before cash dispense`
  - `fix(usecases): implement pre-debit with compensating reversal and deterministic locking`

## Steps

### Step 1: Add `ATMSecret` to Configuration

Modify `backend/internal/config/config.go`:
1. Add `ATMSecret string` to `Config` struct:
   ```go
   type Config struct {
       Port      string
       DB        DBConfig
       JWTSecret map[bool]string
       Redis     Redis
       ATMSecret string
   }
   ```
2. Populate `ATMSecret` in `NewConfig()`:
   ```go
   ATMSecret: getEnv("ATM_SHARED_SECRET", "bank-core-atm-secret-key-2026"),
   ```

**Verify**:
`cd backend && go test ./internal/...` → compiles and tests pass.

---

### Step 2: Implement `ATMMachineAuthMiddleware`

Modify `backend/internal/api/middleware/middleware.go`:
1. Define ATM-restricted route prefixes:
   ```go
   var atmMachineRoutes = map[string]bool{
       "/transaction/withdraw/verify":    true,
       "/transaction/withdraw/confirm":   true,
       "/transaction/atm/deposit/lookup": true,
       "/transaction/atm/deposit":        true,
   }
   ```
2. Remove these 4 routes from `unprotectedRoutes` so they do not bypass security entirely.
3. In `AuthMiddleware`, add an ATM machine authentication check before JWT token extraction:
   ```go
   if atmMachineRoutes[r.URL.Path] {
       atmSecret := r.Header.Get("X-ATM-Secret")
       if atmSecret == "" || atmSecret != cfg.ATMSecret {
           responses.Unauthorized(w, errors.New("unauthorized: invalid or missing ATM machine secret key"))
           return
       }
       next.ServeHTTP(w, r)
       return
   }
   ```
4. Update `CORSMiddleware` `Access-Control-Allow-Headers` to include `"X-ATM-Secret"`.

**Verify**:
`cd backend && go test ./internal/api/middleware -v` → exits 0.

---

### Step 3: Secure ATM Hardware Client with `X-ATM-Secret` and Confirm-First Dispense

Modify `backend/atm/main.go`:
1. Add helper to resolve ATM secret:
   ```go
   func getATMSecret() string {
       if s := os.Getenv("ATM_SHARED_SECRET"); s != "" {
           return s
       }
       return "bank-core-atm-secret-key-2026"
   }
   ```
2. In all HTTP requests to Bank Core (`/transaction/withdraw/verify`, `/transaction/withdraw/confirm`, `/transaction/atm/deposit/lookup`, `/transaction/atm/deposit`), set header:
   ```go
   httpReq.Header.Set("X-ATM-Secret", getATMSecret())
   ```
3. In `claimCash`, **reverse the sequence**:
   - Step A: Verify with Bank Core (`/transaction/withdraw/verify`). If failed, return error immediately.
   - Step B: Confirm ledger with Bank Core (`/transaction/withdraw/confirm`) **FIRST**.
     If `confirmResp.StatusCode != http.StatusOK`, **abort immediately without dispensing cash** and return the bank error response.
   - Step C: **Only after** Bank Core confirms ledger deduction with HTTP 200 OK, execute `simulateDispense(units)` and respond with success.

**Verify**:
`cd backend/atm && go build -o /dev/null main.go` (or `go vet ./...`) → compiles clean.

---

### Step 4: Refactor Direct `Withdrawal` with Pre-Debit & Compensating Reversal

Modify `backend/internal/api/usecases/transaction.go`:
1. In `Withdrawal`:
   - Enforce deterministic lock ordering between customer account and vault account:
     ```go
     firstLockID := req.AccountID
     secondLockID := vaultAccountID
     if firstLockID > secondLockID {
         firstLockID, secondLockID = secondLockID, firstLockID
     }
     firstAcc, err := u.AccountRepo.GetAccountByIDForUpdate(tx, firstLockID)
     secondAcc, err := u.AccountRepo.GetAccountByIDForUpdate(tx, secondLockID)
     ```
   - Deduct customer balance, credit vault account, write Journal entry, and **commit the DB transaction** before dispatching hardware.
   - Dispatch `u.ATMClient.DispenseCash(ctx, atmID, req.Amount)`.
   - If `DispenseCash` fails or hardware jams:
     - Execute an automatic compensating transaction (`REVERSAL` journal entry) within a new DB transaction, debiting the vault and crediting the customer's account back.
     - Persist an `atm.dispense_failed` event to outbox.
     - Return error: `fmt.Errorf("ATM hardware dispense failed: %w. Funds have been automatically reversed to your account", err)`.
2. In `ATMDeposit`:
   - Apply deterministic lock ordering (`min(customerID, vaultID) -> max(...)`) before acquiring row locks, eliminating the circular wait risk when `customerAcc.ID > 103`.

**Verify**:
`cd backend && go test ./internal/api/usecases -v` → passes.

---

### Step 5: Implement Automated Unit Tests

1. Create `backend/internal/api/usecases/transaction_test.go`:
   - `TestWithdrawal_DeterministicLockOrder`: Confirms accounts are locked in ascending order.
   - `TestATMDeposit_DeterministicLockOrder`: Confirms `min/max` lock ordering for account IDs > 103.
   - `TestWithdrawal_CompensatingReversalOnHardwareFailure`: Simulates mock ATM client returning a hardware jam error, verifies that customer balance is safely restored via compensating reversal.
2. In `backend/internal/api/middleware/middleware_test.go`:
   - `TestATMMachineAuth_ValidSecret`: `POST /transaction/atm/deposit` with valid `X-ATM-Secret` header succeeds (passes to next handler).
   - `TestATMMachineAuth_MissingSecret`: Rejected with 401 Unauthorized.
   - `TestATMMachineAuth_InvalidSecret`: Rejected with 401 Unauthorized.

**Verify**:
`cd backend && go test ./internal/api/controllers ./internal/api/middleware ./internal/api/usecases -v` → all pass.

## Test plan

- Test 1: Calling `/transaction/withdraw/verify` or `/transaction/atm/deposit` without `X-ATM-Secret` returns 401.
- Test 2: Calling with valid `X-ATM-Secret` succeeds without requiring customer JWT cookie.
- Test 3: Cardless withdrawal at ATM machine halts and refuses to dispense banknotes if Bank Core `confirm` fails.
- Test 4: Direct `Withdrawal` automatically reverses balance if ATM hardware fails to dispense cash.
- Test 5: Full test suite passes:
  ```bash
  cd backend && go test ./internal/... -v
  ```

## Done criteria

- [ ] `cd backend && go test ./internal/...` exits 0.
- [ ] Direct HTTP requests to ATM endpoints without `X-ATM-Secret` receive 401 Unauthorized.
- [ ] ATM hardware simulator in `backend/atm/main.go` only dispenses cash after Bank Core confirmation succeeds.
- [ ] Deterministic lock ordering enforced across `Withdrawal` and `ATMDeposit`.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:
- `ATMClient` interface has incompatible mock dependencies that break existing callers.
- A test failure cannot be resolved within the in-scope files.
- The ATM service network configuration in `docker-compose.yml` or `deploy.sh` prevents passing the secret.

## Maintenance notes

- In production environments, override `ATM_SHARED_SECRET` in `.env` with a 32+ byte cryptographically random hex string.
- Hardware reversal journal entries use `transaction_type = 'REVERSAL'` linked to the original reference ID for audit reconciliation.
