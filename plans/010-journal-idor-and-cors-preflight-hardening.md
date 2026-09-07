# Plan 010: Journal Details IDOR Protection, CORS Preflight, and Logout Cookie Hardening

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dea4c..HEAD -- backend/internal/api/controllers/ledger.go backend/internal/api/controllers/auth.go backend/internal/api/middleware/middleware.go`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/008-authorization-idor-privacy-hardening.md
- **Category**: security
- **Planned at**: commit `55dea4c`, 2026-09-07

## Why this matters

While Plan 008 successfully eliminated IDOR vulnerabilities on `/account/{id}` and `/ledger/statement/{id}`, `GET /ledger/journal/{id}` was left completely unprotected: any logged-in user can submit an arbitrary journal UUID and inspect counterparty account numbers, transaction amounts, and balance postings across the entire bank. Concurrently, `AuthMiddleware` rejects all preflight HTTP `OPTIONS` requests with 401 Unauthorized before `CORSMiddleware` can respond, breaking cross-origin API access for browser clients sending custom headers like `Idempotency-Key`. Finally, `LogoutHandler` returns 401 and aborts without clearing browser cookies if a user's `refresh_token` has expired. Completing this plan seals the remaining financial data leak, resolves cross-origin preflight errors, and guarantees clean session termination.

## Current state

The relevant files and their roles:
- `backend/internal/api/controllers/ledger.go` — contains `GetJournalDetailsHandler` (lines 89–109) with missing ownership verification.
- `backend/internal/api/controllers/auth.go` — contains `LogoutHandler` (lines 73–91) which aborts on missing refresh token before clearing cookies.
- `backend/internal/api/middleware/middleware.go` — contains `AuthMiddleware` (lines 57–91), `CORSMiddleware` (lines 130–138), and `DefaultMiddleware` (lines 151–157).

### Current Code Excerpts

`backend/internal/api/controllers/ledger.go:88-109`:
```go
// GetJournalDetailsHandler returns journal details by UUID
func (c *LedgerController) GetJournalDetailsHandler(w http.ResponseWriter, r *http.Request) {
	journalIdStr, err := utils.GetIDFromRequest(r, "id")
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	journalID, err := uuid.Parse(journalIdStr)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	journal, err := c.Usecase.GetJournalDetails(journalID)
	if err != nil {
		responses.Error(w, http.StatusNotFound, err)
		return
	}

	responses.JSON(w, http.StatusOK, journal)
}
```

`backend/internal/api/controllers/auth.go:73-91`:
```go
// LogoutHandler handles the logout route
func (c *AuthController) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	refreshToken, err := utils.ExtractToken(r, "refresh_token")
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	err = c.Usecase.Logout(refreshToken)
	if err != nil {
		responses.Error(w, http.StatusUnauthorized, err)
		return
	}

	token := &models.LoginResponse{}

	utils.SetToken(w, token, time.Now())
	responses.NoContent(w)
}
```

`backend/internal/api/middleware/middleware.go:130-157`:
```go
// CORSMiddleware adds the necessary headers for CORS
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		next.ServeHTTP(w, r)
	})
}
...
var DefaultMiddleware = ChainMiddleware(
	LoggerMiddleware,
	PanicMiddleware,
	AuthMiddleware,
	CORSMiddleware,
	TimeoutMiddleware,
)
```

### Repo Conventions to Follow
- Follow the authorization pattern in `backend/internal/api/controllers/ledger.go:31-64` (`GetAccountStatementHandler`): extract user ID using `utils.GetUserIdFromRequest(c.Cfg, r, false)` and respond with `responses.Forbidden(w, errors.New("forbidden: ..."))` when unauthorized.
- Standard response helpers: `responses.Forbidden(w, err)`, `responses.Unauthorized(w, err)`, `responses.NotFound(w, err)`, `responses.NoContent(w)`.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Run Unit Tests | `cd backend && go test ./internal/api/controllers -v` | `ok ... internal/api/controllers` |
| Run Middleware Tests | `cd backend && go test ./internal/api/middleware -v` | `ok ... internal/api/middleware` |
| Full Test Suite | `cd backend && go test ./internal/...` | All packages pass |
| Race Detection | `cd backend && go test -race ./internal/...` | Pass with no race reports |

## Scope

**In scope**:
- `backend/internal/api/controllers/ledger.go`
- `backend/internal/api/controllers/ledger_test.go`
- `backend/internal/api/controllers/auth.go`
- `backend/internal/api/controllers/auth_test.go`
- `backend/internal/api/middleware/middleware.go`
- `backend/internal/api/middleware/middleware_test.go`

**Out of scope**:
- Database schema changes (no table alterations required).
- Frontend routing or UI component code.
- ATM hardware client simulator (`backend/atm/`).

## Git workflow

- Branch: `advisor/010-journal-idor-and-cors-preflight-hardening`
- Commits: Conventional Commits style matching repository log (e.g., `git log -n 5 --oneline`).
  - Example 1: `fix(security): prevent IDOR on journal details endpoint`
  - Example 2: `fix(auth): clear session cookies on logout even if refresh token is absent`
  - Example 3: `fix(middleware): allow CORS preflight and support credentials`

## Steps

### Step 1: Enforce Authorization in `GetJournalDetailsHandler`

Modify `backend/internal/api/controllers/ledger.go`:
1. In `GetJournalDetailsHandler`, extract authenticated `userID` from request:
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
   ```
2. Retrieve journal details via `c.Usecase.GetJournalDetails(journalID)`. If not found, return 404 via `responses.NotFound(w, err)`.
3. Fetch user accounts using `c.AccountRepo.GetAccountsByUserID(userID)`.
4. Build a set of owned account IDs:
   ```go
   userAccountIDs := make(map[int64]bool, len(accounts))
   for _, acc := range accounts {
       userAccountIDs[acc.ID] = true
   }
   ```
5. Check if at least one entry in `journal.Postings` has `userAccountIDs[posting.AccountID] == true`.
6. If no posting account matches the user's owned accounts, return `responses.Forbidden(w, errors.New("forbidden: access to this journal is restricted to participating account owners"))`.

**Verify**:
`cd backend && go test ./internal/api/controllers -run TestGetJournalDetails -v` → passes.

---

### Step 2: Ensure `LogoutHandler` Unconditionally Clears Cookies

Modify `backend/internal/api/controllers/auth.go`:
1. In `LogoutHandler`:
   ```go
   refreshToken, err := utils.ExtractToken(r, "refresh_token")
   if err == nil && refreshToken != "" {
       _ = c.Usecase.Logout(refreshToken)
   }

   token := &models.LoginResponse{}
   utils.SetToken(w, token, time.Now())
   responses.NoContent(w)
   ```
2. If `ExtractToken` fails (e.g. cookie expired or missing), do not return 401. Proceed directly to clear the client cookies with `utils.SetToken(w, token, time.Now())` and return `responses.NoContent(w)`.

**Verify**:
`cd backend && go test ./internal/api/controllers -v` → exits 0.

---

### Step 3: Support CORS Preflight (`OPTIONS`) and Dynamic Origin in Middleware

Modify `backend/internal/api/middleware/middleware.go`:
1. Update `CORSMiddleware`:
   - Inspect request `Origin` header. If present, set `Access-Control-Allow-Origin: <origin>` and `Access-Control-Allow-Credentials: true`.
   - If `Origin` header is absent, set `Access-Control-Allow-Origin: *`.
   - Set `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`.
   - Set `Access-Control-Allow-Headers: Content-Type, Authorization, Idempotency-Key`.
   - If `r.Method == http.MethodOptions`, immediately respond with `w.WriteHeader(http.StatusNoContent)` and return.
2. In `AuthMiddleware`:
   - At the beginning of the handler function, allow HTTP `OPTIONS` requests to pass through immediately:
     ```go
     if r.Method == http.MethodOptions {
         next.ServeHTTP(w, r)
         return
     }
     ```
3. In `DefaultMiddleware`:
   - Place `CORSMiddleware` before `AuthMiddleware` in the middleware chain:
     ```go
     var DefaultMiddleware = ChainMiddleware(
         LoggerMiddleware,
         PanicMiddleware,
         CORSMiddleware,
         AuthMiddleware,
         TimeoutMiddleware,
     )
     ```

**Verify**:
`cd backend && go test ./internal/api/middleware -v` → exits 0.

---

### Step 4: Implement Unit Tests for All Three Behaviors

1. Update `backend/internal/api/controllers/ledger_test.go`:
   - `TestGetJournalDetails_Authorized`: Authenticated user who owns an account involved in the journal successfully receives the journal payload (200 OK).
   - `TestGetJournalDetails_Forbidden`: Authenticated user who does NOT own any participating account receives 403 Forbidden.
   - `TestGetJournalDetails_Unauthenticated`: Missing or invalid token receives 401 Unauthorized.
2. Create `backend/internal/api/controllers/auth_test.go`:
   - `TestLogoutHandler_ClearsCookiesWithoutRefreshToken`: Calling `LogoutHandler` with no `refresh_token` cookie returns 204 No Content and sets expired `Set-Cookie` headers.
   - `TestLogoutHandler_ValidRefreshToken`: Calling with valid token revokes in usecase, clears cookies, and returns 204 No Content.
3. Create `backend/internal/api/middleware/middleware_test.go`:
   - `TestCORSMiddleware_PreflightOptions`: Sending `OPTIONS` request to a protected endpoint returns HTTP 204 with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers` without requiring auth.
   - `TestAuthMiddleware_OptionsBypass`: Confirm preflight `OPTIONS` is never blocked with 401.

**Verify**:
`cd backend && go test ./internal/api/controllers ./internal/api/middleware -v` → all tests pass.

## Test plan

- Test 1: `GetJournalDetails` returns 200 when user owns sender or receiver account.
- Test 2: `GetJournalDetails` returns 403 Forbidden when user is authenticated but not a party to the transaction.
- Test 3: `GetJournalDetails` returns 404 Not Found when journal UUID does not exist.
- Test 4: `GetJournalDetails` returns 401 Unauthorized when unauthenticated.
- Test 5: `LogoutHandler` returns 204 and clears cookies when no refresh token cookie exists.
- Test 6: `CORSMiddleware` handles `OPTIONS` preflight with 204 and correct CORS headers for custom headers (`Idempotency-Key`).
- Verification command:
  ```bash
  cd backend && go test ./internal/api/controllers ./internal/api/middleware -v
  ```

## Done criteria

- [ ] `cd backend && go test ./internal/...` exits 0 with all packages passing.
- [ ] `cd backend && go test -race ./internal/...` reports 0 race conditions.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row for Plan 010 is updated.

## STOP conditions

Stop and report back (do not improvise) if:
- Code at `backend/internal/api/controllers/ledger.go` does not match the lines in "Current state".
- `c.AccountRepo.GetAccountsByUserID` signature has changed or is unavailable in `LedgerController`.
- A test failure cannot be resolved without editing code outside the defined scope.

## Maintenance notes

- Any future ledger endpoints that return sensitive posting lines must perform user account ownership checks against the postings slice before outputting financial records.
- When adding new custom HTTP headers (e.g., custom tracing or API versioning headers), ensure they are included in `Access-Control-Allow-Headers` in `CORSMiddleware`.
