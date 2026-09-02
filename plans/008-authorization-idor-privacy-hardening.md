# Plan 008: Authorization IDOR Hardening & Account Privacy Protection

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b98f775..HEAD -- internal/api/controllers/account.go internal/api/controllers/ledger.go internal/api/usecases/account.go internal/api/usecases/ledger.go internal/api/models/account.go frontend/src/lib/api.ts frontend/src/app/transfer/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/006-auth-token-revocation-middleware-hardening.md
- **Category**: security / bug
- **Planned at**: commit `b98f775`, 2026-09-02

## Why this matters

The core banking engine currently exposes sensitive financial data through two insecure API surfaces:
1. **Recipient Balance Leakage on Account Lookup**: `GET /account/{id}` serializes the complete `Account` database record (including `balance` and `user_id`). When User A inputs User B's 10-digit account number to preview recipient details in the Transfer Hub, User A is shown User B's exact private bank balance.
2. **Unauthenticated Ledger Statements (IDOR)**: `GET /ledger/statement/{id}` and `GET /ledger/journal/{id}` perform no identity checks or ownership validation. Any unauthenticated caller can query any account number or internal settlement account (`100`) and extract its complete transaction history, line items, and running balances.

Hardening these endpoints ensures strict multi-tenant isolation, preserves privacy during recipient lookup, and prevents unauthorized statement exfiltration.

## Current state

- `internal/api/controllers/account.go:88-136` — `GetAccountByIDHandler` dumps full `models.Account` with balance:
  ```go
  func (c *AccountController) GetAccountByIDHandler(w http.ResponseWriter, r *http.Request) {
  	// ...
  	account, err := c.Usecase.GetAccountByNumber(cleanParam)
  	if err == nil && account != nil {
  		responses.JSON(w, http.StatusOK, account) // Leaks balance!
  		return
  	}
  ```
- `internal/api/controllers/ledger.go:27-60` — `GetAccountStatementHandler` omits auth/ownership verification:
  ```go
  func (c *LedgerController) GetAccountStatementHandler(w http.ResponseWriter, r *http.Request) {
  	accountIdStr, err := utils.GetIDFromRequest(r, "id")
  	// No GetUserIdFromRequest check, no ownership check!
  	entries, err := c.Usecase.GetAccountStatement(accountID, limit, offset)
  	responses.JSON(w, http.StatusOK, entries)
  }
  ```
- `frontend/src/app/transfer/page.tsx:106-118` — Uses `api.accounts.getById` for recipient lookup:
  ```ts
  const res = await api.accounts.getById(cleanDigits);
  if (res.data && res.data.id) {
    setRecipientAccount(res.data);
  }
  ```

## Commands you will need

| Purpose     | Command                     | Expected on success |
|-------------|-----------------------------|---------------------|
| Go Build    | `go build ./cmd/...`        | exit 0              |
| Go Tests    | `go test ./...`             | exit 0              |
| TS Check    | `pnpm --prefix frontend exec tsc --noEmit` | exit 0 |

## Scope

**In scope**:
- `internal/api/models/account.go`
- `internal/api/controllers/account.go`
- `internal/api/controllers/ledger.go`
- `internal/api/usecases/account.go`
- `internal/api/usecases/ledger.go`
- `frontend/src/lib/types.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/app/transfer/page.tsx`

**Out of scope**:
- Database triggers on `ledger_entries` (immutability trigger remains unchanged).
- Modifying `POST /transaction/transfer` backend implementation.

## Git workflow

- Branch: `advisor/008-idor-privacy-hardening`
- Commit style: `sec(auth): enforce account ownership on ledger statements and sanitize recipient preview`

---

## Steps

### Step 1: Define `AccountPreviewResponse` & Sanitized Lookup

1. In [internal/api/models/account.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/models/account.go), add the public preview model:
   ```go
   type AccountPreviewResponse struct {
   	ID                int64  `json:"id"`
   	AccountNumber     string `json:"account_number"`
   	AccountHolderName string `json:"account_holder_name"`
   	Currency          string `json:"currency"`
   	AccountType       string `json:"account_type"`
   	Status            string `json:"status"`
   }
   ```

2. In [internal/api/controllers/account.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/controllers/account.go), add `GetAccountPreviewHandler`:
   ```go
   // GetAccountPreviewHandler returns safe public recipient info without disclosing balances
   func (c *AccountController) GetAccountPreviewHandler(w http.ResponseWriter, r *http.Request) {
   	queryParam, err := utils.GetIDFromRequest(r, "id")
   	if err != nil {
   		responses.BadRequest(w, err)
   		return
   	}
   
   	cleanParam := ""
   	for _, ch := range queryParam {
   		if ch >= '0' && ch <= '9' {
   			cleanParam += string(ch)
   		}
   	}
   
   	if cleanParam == "" {
   		responses.BadRequest(w, errors.New("invalid account parameter"))
   		return
   	}
   
   	account, err := c.Usecase.GetAccountByNumber(cleanParam)
   	if err != nil || account == nil {
   		accountID, parseErr := utils.StringToInt64(cleanParam)
   		if parseErr == nil {
   			account, err = c.Usecase.GetAccountByID(accountID)
   		}
   	}
   
   	if err != nil || account == nil {
   		responses.NotFound(w, errors.New("account not found"))
   		return
   	}
   
   	preview := &models.AccountPreviewResponse{
   		ID:                account.ID,
   		AccountNumber:     account.AccountNumber,
   		AccountHolderName: account.AccountHolderName,
   		Currency:          account.Currency,
   		AccountType:       account.AccountType,
   		Status:            account.Status,
   	}
   	responses.JSON(w, http.StatusOK, preview)
   }
   ```

3. In [internal/api/controllers/account.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/controllers/account.go), update `GetAccountByIDHandler` to verify that the requesting user owns the account before returning the full model with `balance`. If another user or unauthenticated client requests it, return 403 Forbidden.

**Verify**: `go build ./cmd/...` → exit 0.

---

### Step 2: Enforce Ownership in `LedgerController`

Open [internal/api/controllers/ledger.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/controllers/ledger.go):
1. In `GetAccountStatementHandler`: Extract user ID from token and verify that the account belongs to the caller:
   ```go
   userIdStr, err := utils.GetUserIdFromRequest(c.Cfg, r, false)
   if err != nil {
   	responses.Unauthorized(w, err)
   	return
   }
   userID, err := uuid.Parse(userIdStr)
   if err != nil {
   	responses.Unauthorized(w, err)
   	return
   }
   
   // Verify account ownership
   acc, err := c.AccountRepo.GetAccountByID(accountID)
   if err != nil || acc == nil {
   	responses.NotFound(w, errors.New("account not found"))
   	return
   }
   if acc.UserID != userID {
   	responses.Forbidden(w, errors.New("forbidden: access to this statement is restricted to the account owner"))
   	return
   }
   ```
2. Pass `accountRepo` to `NewLedgerController` or verify in `LedgerUsecase`.

**Verify**: `go test ./...` → exit 0.

---

### Step 3: Update Frontend Recipient Lookup to Use Preview Endpoint

1. In [frontend/src/lib/types.ts](file:///c:/Users/JuneP/Documents/Dev/bank-core/frontend/src/lib/types.ts), add:
   ```ts
   export interface AccountPreview {
     id: number;
     account_number: string;
     account_holder_name: string;
     currency: string;
     account_type: string;
     status: string;
   }
   ```

2. In [frontend/src/lib/api.ts](file:///c:/Users/JuneP/Documents/Dev/bank-core/frontend/src/lib/api.ts), add `getPreview`:
   ```ts
   getPreview: (accountNumberOrId: string | number) =>
     request<AccountPreview>(`/account/preview/${accountNumberOrId}`, { method: "GET" }),
   ```

3. In [frontend/src/app/transfer/page.tsx](file:///c:/Users/JuneP/Documents/Dev/bank-core/frontend/src/app/transfer/page.tsx), update `useEffect` recipient lookup from `api.accounts.getById` to `api.accounts.getPreview`.

**Verify**: `pnpm --prefix frontend exec tsc --noEmit` → exit 0.

---

## Test plan

- Test `GET /account/preview/{accountNumber}` returns 200 with name and ID but without `balance`.
- Test `GET /ledger/statement/{accountId}` for another user's account returns 403 Forbidden.
- Test `GET /ledger/statement/{accountId}` for owned account returns 200 with statement entries.
- Run frontend typecheck: `pnpm --prefix frontend exec tsc --noEmit` → all clean.

## Done criteria

- [ ] `go build ./cmd/...` exits 0.
- [ ] `go test ./...` exits 0.
- [ ] `pnpm --prefix frontend exec tsc --noEmit` exits 0.
- [ ] Recipient lookup no longer leaks foreign balances.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If any existing UI page relies on reading recipient balance from `GET /account/{id}`, stop and ensure it only relies on the sender's own balance.
