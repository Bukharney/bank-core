# Plan 003: Ledger Statement Pagination & Date Range Filtering

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c35c529..HEAD -- frontend/src/app/ledger/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: ux / data exploration
- **Planned at**: commit `c35c529`, 2026-09-01

## Why this matters

In `frontend/src/app/ledger/page.tsx`, the ledger statement is currently fetched with a fixed `limit=100, offset=0`. When accounts accumulate hundreds or thousands of double-entry postings, older postings cannot be browsed, and users cannot filter records within specific accounting date ranges.

Adding clean pagination ("Load More" or Prev/Next page controls) along with an optional Date Range filter improves ledger auditability to enterprise accounting standards.

## Current state

In `frontend/src/app/ledger/page.tsx`:
```tsx
  const fetchStatement = async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const res = await api.ledger.getStatement(activeAccount.id, 100, 0);
      if (res.data) {
        setStatement(res.data);
      }
...
```

## Scope

**In scope**:
- `frontend/src/app/ledger/page.tsx`

**Out of scope**:
- Database migration (backend `GET /ledger/account/{id}/statement?limit=X&offset=Y` already supports `limit` and `offset`).

## Steps

### Step 1: Add Pagination State & Page Controls

In `frontend/src/app/ledger/page.tsx`:
1. Add pagination states:
   ```tsx
   const [page, setPage] = useState<number>(0);
   const [pageSize, setPageSize] = useState<number>(20);
   const [hasMore, setHasMore] = useState<boolean>(true);
   ```
2. Update `fetchStatement` to pass `pageSize` and `page * pageSize` as offset.
3. If returning fewer items than `pageSize`, set `hasMore = false`.
4. Render Previous / Next page pagination buttons under the table with current page indicator.

**Verify**: Run `pnpm exec tsc --noEmit` inside `frontend/` → exit code 0.

### Step 2: Add Date Range Filter Input

1. Add `startDate` and `endDate` state (`string`, e.g. `YYYY-MM-DD`).
2. Add a collapsible/inline date range selector next to the search bar.
3. Filter `statement` records by comparing `entry.created_at` against the selected date boundaries.

**Verify**: Run `pnpm run build` inside `frontend/` → exit code 0.

## Done criteria

- [ ] `pnpm exec tsc --noEmit` exits with code 0.
- [ ] `pnpm run build` compiles with 0 errors.
- [ ] Ledger page supports browsing previous and next pages of postings.
- [ ] Date filtering filters records accurately.
- [ ] `plans/README.md` status row is updated to `DONE`.

## STOP conditions

Stop and report back if:
- `api.ledger.getStatement` does not accept offset parameters.
