# Plan 002: Persistent Balance Privacy Setting in Dashboard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c35c529..HEAD -- frontend/src/app/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: ux / privacy
- **Planned at**: commit `c35c529`, 2026-09-01

## Why this matters

In `frontend/src/app/page.tsx`, the balance privacy toggle (`hideBalance`) defaults to `false` and is held purely in React local component state. Whenever a user refreshes the page or navigates between tabs, their balance privacy preference is lost and balances become visible again.

Persisting this preference in `localStorage` (`"bank-core-hide-balance"`) ensures that privacy-minded users who work in public or shared spaces retain their privacy setting across sessions.

## Current state

In `frontend/src/app/page.tsx`:
```tsx
const [hideBalance, setHideBalance] = useState<boolean>(false);
```

## Scope

**In scope**:
- `frontend/src/app/page.tsx`

**Out of scope**:
- Backend API or database schema.

## Steps

### Step 1: Initialize and synchronize `hideBalance` with `localStorage`

In `frontend/src/app/page.tsx`:
1. On component mount (`useEffect`), read `localStorage.getItem("bank-core-hide-balance")`:
   - If `"true"`, set `setHideBalance(true)`.
2. In the toggle click handler:
   - Calculate `nextState = !hideBalance`.
   - Update `setHideBalance(nextState)`.
   - Call `localStorage.setItem("bank-core-hide-balance", String(nextState))`.

**Verify**: Run `pnpm exec tsc --noEmit` inside `frontend/` → exit code 0.

### Step 2: Build verification

Run `pnpm run build` inside `frontend/` → exit code 0.

## Done criteria

- [ ] `pnpm exec tsc --noEmit` exits with code 0.
- [ ] `pnpm run build` compiles with 0 errors.
- [ ] Toggling hide balance persists across browser reloads.
- [ ] `plans/README.md` status row is updated to `DONE`.

## STOP conditions

Stop and report back if:
- `localStorage` is accessed outside client-side mount without checking `typeof window !== "undefined"`.
