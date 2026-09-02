# Bank Core Engine - Bruno API Collection

This directory contains the official **Bruno API Collection** for testing, developing, and automating requests against the **Bank Core Engine**.

---

## 📂 Collection Structure

```text
bruno/
├── bruno.json                      # Collection manifest
├── collection.bru                  # Global scripts & headers
├── environments/
│   ├── local.bru                   # Local development environment (http://localhost:8080)
│   └── docker.bru                  # Docker container network environment
├── Auth/                           # Authentication & session endpoints
│   ├── Login.bru
│   ├── Get Current User (Me).bru
│   ├── Refresh Token.bru
│   ├── Logout.bru
│   └── Auth Test Ping.bru
├── User/                           # User lifecycle & security
│   ├── Register User.bru
│   ├── Update Profile (PATCH).bru
│   ├── Update Profile (PUT).bru
│   ├── Change Password.bru
│   └── Set PIN.bru
├── Account/                        # Core deposit & savings accounts
│   ├── Create Account.bru
│   ├── List Accounts.bru
│   ├── Get Account By ID.bru
│   └── Get Account Preview.bru
├── Transaction/                    # Transfers, deposits, ATM cardless withdrawals
│   ├── Deposit.bru
│   ├── Withdraw.bru
│   ├── Transfer.bru
│   ├── Request Cardless Withdrawal.bru
│   ├── Verify Cardless Withdrawal.bru
│   └── Confirm Cardless Withdrawal.bru
├── Ledger/                         # Immutable double-entry ledger & statements
│   ├── Get Account Statement.bru
│   └── Get Journal Details.bru
├── Observability/                  # Monitoring & health
│   └── Prometheus Metrics.bru
└── E2E Banking Journey/            # Automated end-to-end user lifecycle test flow
    ├── 01 - Register User.bru
    ├── 02 - Login.bru
    ├── 03 - Set PIN.bru
    ├── 04 - Create Account A.bru
    ├── 05 - Create Account B.bru
    ├── 06 - Deposit into Account A.bru
    ├── 07 - Transfer from Account A to B.bru
    ├── 08 - Verify Statement Account A.bru
    └── 09 - Verify Statement Account B.bru
```

---

## 🚀 Getting Started

### 1. Using the Bruno GUI App
1. Download and open [Bruno](https://www.usebruno.com/).
2. Click **"Open Collection"** and select the `bruno/` directory in this repository.
3. Select the `local` environment from the top-right environment selector.
4. Run requests in any order or execute the folders sequentially.

### 2. Automated CLI Execution
You can run the entire collection or the automated E2E journey headlessly using Bruno CLI:

```bash
# Run entire API collection against local environment
npm run test:bruno

# Run only the automated E2E banking flow
npm run test:bruno:e2e
```

Or using `npx @usebruno/cli`:
```bash
npx @usebruno/cli run bruno --env local
npx @usebruno/cli run "bruno/E2E Banking Journey" --env local
```

---

## 🔑 Authentication & Tokens
- **Cookie Jar:** The backend issues HTTP-only `access_token` and `refresh_token` cookies. Bruno automatically captures and persists these cookies across requests.
- **Script Variables:** `Login.bru` and `Refresh Token.bru` additionally extract `access_token` and `refresh_token` into runtime variables to guarantee full compatibility when running in headless CLI environments.

## 🛡️ Idempotency Keys
- Mutating transaction endpoints require an `X-Idempotency-Key` header.
- The collection includes a global pre-request script in `collection.bru` that generates a fresh standard UUID v4 for each transaction request if one is not already provided.
