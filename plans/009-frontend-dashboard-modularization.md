# Plan 009: Frontend Dashboard Modularization & ATM Gateway Proxy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b98f775..HEAD -- frontend/src/app/page.tsx frontend/src/lib/api.ts frontend/next.config.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech debt / architecture / DX
- **Planned at**: commit `b98f775`, 2026-09-02

## Why this matters

1. **Dashboard Maintainability & Performance**: `frontend/src/app/page.tsx` has swollen to over 850 lines containing multi-card carousels, quick actions (deposit, withdraw, PIN setups), full transaction statements, and modal state machines in a single file. Modularizing this file into decoupled dashboard components (`AccountCard`, `QuickActions`, `RecentActivity`, `SecurityStatusCard`) improves render efficiency, eliminates code duplication, and makes testing seamless.
2. **ATM Simulator Proxy Resilience**: `claimAtATM` in `frontend/src/lib/api.ts` directly fetches `http://localhost:808X/atm/claim` from the browser. This fails in Docker, cloud, HTTPS, or non-localhost environments due to CORS and mixed-content blocking. Routing ATM claims through Next.js proxy rewrites or relative paths ensures universal environment compatibility.

## Current state

- `frontend/src/app/page.tsx:1-850` — Monolithic single-file dashboard with inline components and modals.
- `frontend/src/lib/api.ts:171-185` — Direct hardcoded localhost port calls:
  ```ts
  claimAtATM: async (atmId: number, phoneNumber: string, code: string) => {
    const port = 8080 + atmId;
    const res = await fetch(`http://localhost:${port}/atm/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phoneNumber, code }),
    });
  ```
- `frontend/next.config.mjs:1-14` — Only rewrites `/api/:path*`:
  ```js
  const nextConfig = {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8080/:path*",
        },
      ];
    },
  };
  ```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm --prefix frontend exec tsc --noEmit` | exit 0, no errors |
| Lint      | `pnpm --prefix frontend lint` | exit 0          |
| Build     | `pnpm --prefix frontend build` | exit 0, compiled successfully |

## Scope

**In scope**:
- `frontend/src/components/dashboard/AccountCard.tsx` (new)
- `frontend/src/components/dashboard/QuickActions.tsx` (new)
- `frontend/src/components/dashboard/RecentActivity.tsx` (new)
- `frontend/src/components/dashboard/SecurityStatusCard.tsx` (new)
- `frontend/src/app/page.tsx`
- `frontend/src/lib/api.ts`
- `frontend/next.config.mjs`

**Out of scope**:
- Modifications to Go backend ATM service implementation (`atm/main.go`).
- Changes to authentication context (`AuthContext.tsx`).

## Git workflow

- Branch: `advisor/009-dashboard-modularization`
- Commit style: `refactor(frontend): decompose dashboard into modular components and proxy atm claims`

---

## Steps

### Step 1: Add ATM Simulator Proxy Rewrites in `next.config.mjs`

Open [frontend/next.config.mjs](file:///c:/Users/JuneP/Documents/Dev/bank-core/frontend/next.config.mjs) and configure rewrites for ATM simulator endpoints:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/atm/1/:path*",
        destination: "http://localhost:8081/atm/:path*",
      },
      {
        source: "/api/atm/2/:path*",
        destination: "http://localhost:8082/atm/:path*",
      },
      {
        source: "/api/atm/3/:path*",
        destination: "http://localhost:8083/atm/:path*",
      },
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/:path*",
      },
    ];
  },
};

export default nextConfig;
```

Update `claimAtATM` in [frontend/src/lib/api.ts](file:///c:/Users/JuneP/Documents/Dev/bank-core/frontend/src/lib/api.ts):
```ts
claimAtATM: async (atmId: number, phoneNumber: string, code: string) => {
  const res = await fetch(`/api/atm/${atmId}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, code }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  return data as ClaimResponse;
},
```

**Verify**: `pnpm --prefix frontend exec tsc --noEmit` → exit 0.

---

### Step 2: Create Modular Dashboard Components

1. **Account Card Component**: Create `frontend/src/components/dashboard/AccountCard.tsx` to handle:
   - Debit card visualization with gradient themes and chip graphics.
   - Balance privacy toggle (`showBalance`).
   - Account switching and copy-to-clipboard account number button.

2. **Quick Actions Component**: Create `frontend/src/components/dashboard/QuickActions.tsx` to handle:
   - Transfer, Deposit, Cash Withdrawal, and ATM Cardless Cash Out buttons.
   - Triggering respective modal states cleanly.

3. **Security Status Card**: Create `frontend/src/components/dashboard/SecurityStatusCard.tsx` to handle:
   - Transaction PIN configuration reminder/badge.
   - Account verification status.

4. **Recent Activity Component**: Create `frontend/src/components/dashboard/RecentActivity.tsx` to handle:
   - Statement fetching, date formatting, and transaction item rows with debit/credit indicators.
   - Direct link to full Ledger Statement page (`/ledger`).

**Verify**: `pnpm --prefix frontend exec tsc --noEmit` → exit 0.

---

### Step 3: Refactor `frontend/src/app/page.tsx`

Refactor [frontend/src/app/page.tsx](file:///c:/Users/JuneP/Documents/Dev/bank-core/frontend/src/app/page.tsx) to compose the new dashboard subcomponents:
- Keep root page logic clean and focused on coordinate layout and modal dispatching.
- Retain all action modals (`ActionModal`, `KeypadPinModal`, `ATMSimulatorModal`, `ReceiptModal`).
- Reduce `page.tsx` from 850+ lines to under 250 lines.

**Verify**: `pnpm --prefix frontend exec tsc --noEmit` → exit 0.

---

## Test plan

- Run TypeScript typecheck: `pnpm --prefix frontend exec tsc --noEmit` → 0 errors.
- Run frontend linter: `pnpm --prefix frontend lint` → 0 warnings.
- Build production bundle: `pnpm --prefix frontend build` → successful compilation.
- Verify dashboard visual layout matches existing design system and theme aesthetics.

## Done criteria

- [ ] `frontend/src/app/page.tsx` length is reduced to <250 lines.
- [ ] `frontend/src/components/dashboard/` contains modular components.
- [ ] `claimAtATM` uses relative proxy path `/api/atm/:id/claim`.
- [ ] `pnpm --prefix frontend build` completes with exit 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If any prop interface is missing between `page.tsx` and subcomponents, verify `types.ts` before proceeding.
