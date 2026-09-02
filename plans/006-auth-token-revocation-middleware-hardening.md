# Plan 006: Auth Token Revocation & Middleware Resilience Hardening

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b98f775..HEAD -- internal/api/controllers/auth.go internal/api/middleware/middleware.go internal/api/repositories/auth.go internal/api/usecases/auth.go internal/api/models/auth.go`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / security
- **Planned at**: commit `b98f775`, 2026-09-02

## Why this matters

The authentication lifecycle contains three correctness and security vulnerabilities:
1. **Missing Return in `LoginHandler`**: If decoding the JSON request body fails, `responses.BadRequest(w, err)` is invoked without returning, allowing execution to fall through to validation and usecase logic, writing duplicate HTTP headers or panicking.
2. **Broken Token Refresh Flow**: When a user's `access_token` expires, calling `GET /auth/refresh` is rejected with `401 Unauthorized` by `AuthMiddleware` before the refresh handler can run because `/auth/refresh` is missing from `unprotectedRoutes`.
3. **Ignored Token Revocation**: `AuthUsecase.RefreshToken` mints new tokens based solely on JWT signature without verifying whether the refresh token was revoked or deleted in Redis upon logout. Furthermore, Redis keys lack proper namespace prefixes and TTLs.
4. **Premature 1-Second Timeout**: `TimeoutMiddleware` enforces a hardcoded 1-second request timeout, prematurely terminating legitimate database operations, stress loads, and ATM hardware interactions.

Fixing these issues ensures bulletproof token invalidation on logout, reliable session extension via refresh tokens, and server resilience under real-world request latencies.

## Current state

- `internal/api/controllers/auth.go:30-37` — `LoginHandler` lacks `return` after `responses.BadRequest(w, err)`:
  ```go
  func (c *AuthController) LoginHandler(w http.ResponseWriter, r *http.Request) {
  	login := &models.UserCredentials{}
  	err := utils.DecodeJSON(r, login)
  	if err != nil {
  		responses.BadRequest(w, err)
  	}
  
  	err = c.Validate.Struct(login)
  ```
- `internal/api/middleware/middleware.go:17-24` — `unprotectedRoutes` does not include `/auth/refresh` or `/auth/logout`:
  ```go
  var unprotectedRoutes = map[string]bool{
  	"/metrics":                      true,
  	"/user/register":                true,
  	"/auth/login":                   true,
  	"/auth/test":                    true,
  	"/transaction/withdraw/verify":  true,
  	"/transaction/withdraw/confirm": true,
  }
  ```
- `internal/api/middleware/middleware.go:44-47` — `TimeoutMiddleware` has a rigid 1-second timeout:
  ```go
  func TimeoutMiddleware(next http.Handler) http.Handler {
  	timeout := 1
  	return http.TimeoutHandler(next, time.Duration(timeout)*time.Second, "Request timed out")
  }
  ```
- `internal/api/usecases/auth.go:68-95` — `RefreshToken` only validates JWT signature and ignores Redis blacklist/revocation:
  ```go
  func (u *AuthUsecase) RefreshToken(refreshToken string) (*models.LoginResponse, error) {
  	userIdStr, err := utils.ParseToken(u.Cfg, refreshToken, true)
  	if err != nil {
  		return nil, fmt.Errorf("invalid refresh token")
  	}
  	// Does NOT verify if refreshToken matches the token in Redis!
  ```
- `internal/api/repositories/auth.go:28-36` — Stores token at key `userId` with 0 TTL:
  ```go
  func (r *AuthRepository) UpdateRefreshToken(userId string, refreshToken string) error {
  	_, err := r.Rdb.Set(context.Background(), userId, refreshToken, 0).Result()
  	return err
  }
  ```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `go build ./cmd/...`     | exit 0              |
| Unit Test | `go test ./...`          | exit 0, all pass    |
| Vet       | `go vet ./...`           | exit 0, no warnings |

## Scope

**In scope**:
- `internal/api/controllers/auth.go`
- `internal/api/middleware/middleware.go`
- `internal/api/models/auth.go`
- `internal/api/repositories/auth.go`
- `internal/api/usecases/auth.go`
- `internal/api/usecases/auth_test.go` (create new test)

**Out of scope**:
- Password hashing logic or bcrypt configurations.
- Schema changes in PostgreSQL (Redis handles token tracking).
- Modifications to frontend authentication hooks.

## Git workflow

- Branch: `advisor/006-auth-hardening`
- Commit style: `fix(auth): prevent fallthrough on invalid JSON and enforce redis token revocation`

---

## Steps

### Step 1: Add Missing Return in `LoginHandler`

Open [internal/api/controllers/auth.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/controllers/auth.go) and ensure `return` is executed immediately after `responses.BadRequest(w, err)`:

```go
func (c *AuthController) LoginHandler(w http.ResponseWriter, r *http.Request) {
	login := &models.UserCredentials{}
	err := utils.DecodeJSON(r, login)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}

	err = c.Validate.Struct(login)
	if err != nil {
		responses.BadRequest(w, err)
		return
	}
	// ...
```

**Verify**: `go build ./cmd/...` → exit 0.

---

### Step 2: Update `AuthRepository` with Key Namespacing & Token Validation

1. Open [internal/api/models/auth.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/models/auth.go) and add `GetRefreshToken` to `AuthRepository` interface:
   ```go
   type AuthRepository interface {
   	UpdateRefreshToken(userId string, refreshToken string, ttl time.Duration) error
   	GetRefreshToken(userId string) (string, error)
   	RevokeRefreshToken(userId string) error
   }
   ```

2. Open [internal/api/repositories/auth.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/repositories/auth.go) and implement namespaced Redis operations with TTL:
   ```go
   const RefreshTokenPrefix = "auth:refresh:"
   
   func (r *AuthRepository) UpdateRefreshToken(userId string, refreshToken string, ttl time.Duration) error {
   	if ttl <= 0 {
   		ttl = 7 * 24 * time.Hour
   	}
   	key := RefreshTokenPrefix + userId
   	return r.Rdb.Set(context.Background(), key, refreshToken, ttl).Err()
   }
   
   func (r *AuthRepository) GetRefreshToken(userId string) (string, error) {
   	key := RefreshTokenPrefix + userId
   	val, err := r.Rdb.Get(context.Background(), key).Result()
   	if err != nil {
   		if errors.Is(err, redis.Nil) {
   			return "", nil
   		}
   		return "", err
   	}
   	return val, nil
   }
   
   func (r *AuthRepository) RevokeRefreshToken(userId string) error {
   	key := RefreshTokenPrefix + userId
   	return r.Rdb.Del(context.Background(), key).Err()
   }
   ```

**Verify**: `go test ./...` → exit 0.

---

### Step 3: Enforce Token Revocation in `AuthUsecase`

Open [internal/api/usecases/auth.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/usecases/auth.go):
1. In `Login`: Pass 7-day TTL to `UpdateRefreshToken`:
   ```go
   err = u.Repo.UpdateRefreshToken(dbUser.ID.String(), refreshToken, 7*24*time.Hour)
   ```
2. In `Logout`: Call `RevokeRefreshToken`:
   ```go
   func (u *AuthUsecase) Logout(refreshToken string) error {
   	userId, err := utils.ParseToken(u.Cfg, refreshToken, true)
   	if err != nil {
   		return fmt.Errorf("invalid refresh token")
   	}
   	return u.Repo.RevokeRefreshToken(userId)
   }
   ```
3. In `RefreshToken`: Verify against Redis before generating new tokens:
   ```go
   func (u *AuthUsecase) RefreshToken(refreshToken string) (*models.LoginResponse, error) {
   	userIdStr, err := utils.ParseToken(u.Cfg, refreshToken, true)
   	if err != nil {
   		return nil, fmt.Errorf("invalid refresh token")
   	}
   
   	// Verify token is active in Redis and has not been revoked/rotated
   	storedToken, err := u.Repo.GetRefreshToken(userIdStr)
   	if err != nil || storedToken == "" || storedToken != refreshToken {
   		return nil, fmt.Errorf("refresh token has been revoked or expired")
   	}
   
   	userID, err := uuid.Parse(userIdStr)
   	if err != nil {
   		return nil, fmt.Errorf("invalid user id in token")
   	}
   
   	accessToken, err := utils.GenerateToken(u.Cfg, userID, false)
   	if err != nil {
   		return nil, err
   	}
   
   	newRefreshToken, err := utils.GenerateToken(u.Cfg, userID, true)
   	if err != nil {
   		return nil, err
   	}
   
   	_ = u.Repo.UpdateRefreshToken(userIdStr, newRefreshToken, 7*24*time.Hour)
   
   	return &models.LoginResponse{
   		AccessToken:  accessToken,
   		RefreshToken: newRefreshToken,
   	}, nil
   }
   ```

**Verify**: `go test ./...` → exit 0.

---

### Step 4: Whitelist `/auth/refresh` and `/auth/logout` in `AuthMiddleware` & Increase Request Timeout

Open [internal/api/middleware/middleware.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/middleware/middleware.go):
1. Update `unprotectedRoutes` to allow `/auth/refresh` and `/auth/logout`:
   ```go
   var unprotectedRoutes = map[string]bool{
   	"/metrics":                      true,
   	"/user/register":                true,
   	"/auth/login":                   true,
   	"/auth/refresh":                 true,
   	"/auth/logout":                  true,
   	"/auth/test":                    true,
   	"/transaction/withdraw/verify":  true,
   	"/transaction/withdraw/confirm": true,
   }
   ```
2. Adjust `TimeoutMiddleware` from 1s to 30s:
   ```go
   func TimeoutMiddleware(next http.Handler) http.Handler {
   	timeout := 30
   	return http.TimeoutHandler(next, time.Duration(timeout)*time.Second, "Request timed out")
   }
   ```

**Verify**: `go test ./...` → exit 0.

---

## Test plan

- Create `internal/api/usecases/auth_test.go` to test:
  1. Login generates access and refresh tokens.
  2. `RefreshToken` succeeds with matching stored token.
  3. `RefreshToken` rejects revoked or mismatched token.
  4. `Logout` revokes token and blocks subsequent refresh attempts.
- Run `go test -v ./internal/api/usecases -run TestAuthUsecase` → all pass.

## Done criteria

- [ ] `go build ./cmd/...` exits 0 with no errors.
- [ ] `go test ./...` exits 0 with all tests passing.
- [ ] `go vet ./...` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If Redis interface signatures in existing tests break, stop and update mock repositories to match the new `AuthRepository` interface methods.
- If existing integration tests depend on expired token behavior, verify test expectations before modifying.

## Maintenance notes

- Any future token rotation scheme (e.g. single-use refresh token with reuse detection) should build on top of `GetRefreshToken` and `RevokeRefreshToken`.
