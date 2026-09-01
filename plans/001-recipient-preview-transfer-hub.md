# Plan 001: Add Real-Time Recipient Account Verification & Preview to Transfer Hub

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c35c529..HEAD -- frontend/src/app/transfer/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / ux
- **Planned at**: commit `c35c529`, 2026-09-01

## Why this matters

Currently in `frontend/src/app/transfer/page.tsx`, the destination account input is a bare numeric text field asking for a raw Account ID (`e.g. 2, 5...`). Users receive no feedback about whether the target account exists, whether it is active, or what currency it holds until after submitting the full transfer request. 

Adding real-time debounced account lookup gives customers an instant visual confirmation badge (verified account number, currency, and status), eliminates mistyped transfer errors before transaction execution, and significantly improves fintech UI fidelity.

## Current state

The relevant files:
- `frontend/src/app/transfer/page.tsx` — Money Transfer Hub page with source selector, recipient input, amount, and submission.
- `frontend/src/lib/api.ts` — Typed API client containing `api.accounts.getById(id: number)`.
- `frontend/src/lib/currency.ts` — Formatters for account numbers (`formatAccountNumber`) and currency.

Current code in `frontend/src/app/transfer/page.tsx` (lines 158–171):
```tsx
          {/* 2. Destination Account Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              To Recipient Account ID
            </label>
            <input
              type="number"
              min="1"
              required
              placeholder="e.g. 2, 5..."
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="w-full rounded-2xl border border-surface-border bg-surface-50 py-3 px-4 text-sm font-mono text-white placeholder-slate-600 focus:border-bank-500 focus:outline-none focus:ring-1 focus:ring-bank-500"
            />
          </div>
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `pnpm run build`         | exit 0, 8/8 routes  |
| Dev       | `pnpm run dev`           | ready on :3000      |
| Typecheck | `pnpm exec tsc --noEmit` | exit 0, no errors   |

## Scope

**In scope**:
- `frontend/src/app/transfer/page.tsx`

**Out of scope**:
- `internal/api/controllers/` — Backend already provides `GET /account/{id}`.
- `frontend/src/lib/api.ts` — `api.accounts.getById` already exists and works.

## Steps

### Step 1: Add debounced recipient account state & lookup hook in `transfer/page.tsx`

In `frontend/src/app/transfer/page.tsx`:
1. Add state variables:
   ```tsx
   const [recipientAccount, setRecipientAccount] = useState<Account | null>(null);
   const [verifyingRecipient, setVerifyingRecipient] = useState<boolean>(false);
   const [recipientError, setRecipientError] = useState<string | null>(null);
   ```
2. Add a `useEffect` with a 350ms debounce that triggers whenever `receiverId` changes:
   - If `receiverId` is empty: clear `recipientAccount` and `recipientError`.
   - If `Number(receiverId) === activeAccount?.id`: set `recipientError("Cannot transfer to your own account")` and clear `recipientAccount`.
   - Otherwise, call `api.accounts.getById(targetId)`.
   - If found and active: set `recipientAccount(res.data)` and clear error.
   - If not found or error: set `recipientError("Account not found or inactive")` and clear account.

**Verify**: Run `pnpm exec tsc --noEmit` in `frontend/` → exit code 0.

### Step 2: Render the Verified Recipient Preview Card beneath the input

Underneath the Recipient Account ID input in `frontend/src/app/transfer/page.tsx`:
1. Render a dynamic feedback container:
   - While `verifyingRecipient`: show a subtle spinner with `"Verifying destination account..."`.
   - When `recipientAccount` is verified: show an emerald-tinted preview card displaying:
     - Check icon (`CheckCircle2`)
     - Account Type & Masked Account Number (`formatAccountNumber(recipientAccount.account_number)`)
     - Currency Badge (`THB`) and Status (`ACTIVE`)
   - When `recipientError`: show a rose-tinted inline alert explaining the issue.

2. In `handleTransfer`, ensure `recipientAccount` is valid and active before submitting.

**Verify**: Run `pnpm run build` in `frontend/` → exit code 0.

## Done criteria

Machine-checkable. ALL must hold:

- [x] `pnpm exec tsc --noEmit` inside `frontend/` exits with code 0.
- [x] `pnpm run build` inside `frontend/` compiles successfully with 0 errors.
- [x] Entering an Account ID in the Transfer Hub renders real-time validation feedback.
- [x] No files outside `frontend/src/app/transfer/page.tsx` are modified.
- [x] `plans/README.md` status row is updated to `DONE` after execution.

## STOP conditions

Stop and report back (do not improvise) if:
- `api.accounts.getById` return type differs from `Account`.
- The Next.js proxy rewrite fails to forward `GET /api/account/{id}`.
