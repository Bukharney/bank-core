# Plan 005: Enhanced Register Form Validation & Password Strength Indicator

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c35c529..HEAD -- frontend/src/app/register/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: ux / auth
- **Planned at**: commit `c35c529`, 2026-09-01

## Why this matters

In `frontend/src/app/register/page.tsx`, new bank customers create an account. When entering phone numbers or passwords, there is no visual guidance regarding password complexity (Weak / Moderate / Strong) or phone number auto-formatting.

Providing live password strength evaluation and phone format assistance improves customer onboarding conversion and prevents account registration friction.

## Current state

In `frontend/src/app/register/page.tsx`:
```tsx
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Password (Min 8 chars)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
...
```

## Scope

**In scope**:
- `frontend/src/app/register/page.tsx`

**Out of scope**:
- Backend password hashing logic (`internal/api/usecases/auth.go`).

## Steps

### Step 1: Add Password Strength Calculation & Visual Bar

In `frontend/src/app/register/page.tsx`:
1. Calculate strength score (0 to 4) based on:
   - Length >= 8
   - Contains numbers
   - Contains uppercase letters
   - Contains special characters
2. Render a 4-segment colored strength bar (Weak: Rose, Fair: Amber, Strong: Emerald).

**Verify**: Run `pnpm exec tsc --noEmit` inside `frontend/` → exit code 0.

### Step 2: Build verification

Run `pnpm run build` inside `frontend/` → exit code 0.

## Done criteria

- [ ] `pnpm exec tsc --noEmit` exits with code 0.
- [ ] `pnpm run build` compiles with 0 errors.
- [ ] Password strength bar updates dynamically as user types.
- [ ] `plans/README.md` status row is updated to `DONE`.

## STOP conditions

Stop and report back if:
- Registration request payload schema changes.
