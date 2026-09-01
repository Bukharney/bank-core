# Plan 004: Official Bank Transfer Slip Print & Export Action in ReceiptModal

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c35c529..HEAD -- frontend/src/components/ReceiptModal.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: ux / feature
- **Planned at**: commit `c35c529`, 2026-09-01

## Why this matters

In `frontend/src/components/ReceiptModal.tsx`, upon a successful fund transfer, users receive an on-screen dialog displaying the amount, reference ID, timestamp, and journal UUID. However, users in banking applications frequently need an official e-Slip that can be saved, printed, or shared with the recipient as proof of payment.

Adding a **"Print / Save Slip"** button that invokes browser printing with optimized print CSS (isolating the receipt card and hiding background overlays) allows customers to save clean PDF receipts or print hard copies.

## Current state

In `frontend/src/components/ReceiptModal.tsx`:
```tsx
        {/* Action Button */}
        <div>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 dark:bg-white py-3 text-sm font-semibold text-white dark:text-slate-900 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98] transition"
          >
            Done
          </button>
        </div>
```

## Scope

**In scope**:
- `frontend/src/components/ReceiptModal.tsx`
- `frontend/src/app/globals.css` (Print media query styling)

**Out of scope**:
- Server-side PDF generation engines.

## Steps

### Step 1: Add Print / Save Slip Button to `ReceiptModal.tsx`

In `frontend/src/components/ReceiptModal.tsx`:
1. Import `Printer` from `lucide-react`.
2. Add a `handlePrint` function that calls `window.print()`.
3. Add a secondary button next to or above "Done":
   ```tsx
   <button
     type="button"
     onClick={handlePrint}
     className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
   >
     <Printer className="h-4 w-4" />
     <span>Print / Save e-Slip</span>
   </button>
   ```

**Verify**: Run `pnpm exec tsc --noEmit` inside `frontend/` → exit code 0.

### Step 2: Add `@media print` CSS utility in `globals.css`

In `frontend/src/app/globals.css`, add print rules so that `window.print()` prints only the receipt card cleanly without dark background scrims or close buttons.

**Verify**: Run `pnpm run build` inside `frontend/` → exit code 0.

## Done criteria

- [ ] `pnpm exec tsc --noEmit` exits with code 0.
- [ ] `pnpm run build` compiles with 0 errors.
- [ ] Clicking "Print / Save e-Slip" triggers the print dialog for the receipt.
- [ ] `plans/README.md` status row is updated to `DONE`.

## STOP conditions

Stop and report back if:
- `window.print` fails in headless test environments.
