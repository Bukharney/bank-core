import {
  Account,
  AccountPreview,
  DepositRequest,
  JournalEntry,
  LedgerEntry,
  TransferReceipt,
  TransferRequest,
  User,
  WithdrawalRequest,
  CardlessWithdrawalTicket,
  ClaimResponse,
} from "./types";

const API_BASE = "/api";

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number; replayed?: boolean }> {
  try {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      cache: "no-store", // Prevent browser disk-cache issues
      credentials: "include", // Ensure JWT cookies are included
    });

    const isReplayed = res.headers.get("X-Idempotent-Replayed") === "true";

    if (res.status === 204) {
      return { data: null, error: null, status: res.status, replayed: isReplayed };
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }

    if (!res.ok) {
      const errorMsg =
        json && typeof json === "object" && "error" in json
          ? json.error
          : typeof json === "string"
          ? json
          : `Request failed with status ${res.status}`;
      return { data: null, error: errorMsg, status: res.status, replayed: isReplayed };
    }

    return { data: json as T, error: null, status: res.status, replayed: isReplayed };
  } catch (err: any) {
    return { data: null, error: err.message || "Network connection error", status: 0 };
  }
}

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),

    register: (userData: {
      username: string;
      email: string;
      phone_number?: string;
      password: string;
      first_name: string;
      last_name: string;
    }) =>
      request<User>("/user/register", {
        method: "POST",
        body: JSON.stringify(userData),
      }),

    me: () => request<User>("/auth/me", { method: "GET" }),

    logout: () => request<void>("/auth/logout", { method: "GET" }),
  },

  user: {
    updateProfile: (data: { first_name: string; last_name: string; phone_number?: string }) =>
      request<User>("/user/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    changePassword: (data: { old_password: string; new_password: string; confirm_password: string }) =>
      request<{ message: string }>("/user/change-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    setPin: (data: { password: string; pin: string; confirm_pin: string }) =>
      request<{ message: string }>("/user/pin", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  accounts: {
    list: () => request<Account[]>("/account", { method: "GET" }),

    getById: (id: number | string) => request<Account>(`/account/${id}`, { method: "GET" }),

    getPreview: (accountNumberOrId: string | number) =>
      request<AccountPreview>(`/account/preview/${accountNumberOrId}`, { method: "GET" }),

    create: (
      data: { account_type: string; currency: string },
      idempotencyKey: string = generateUUID()
    ) =>
      request<Account>("/account/create", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(data),
      }),
  },

  transactions: {
    transfer: (data: TransferRequest, idempotencyKey: string = generateUUID()) =>
      request<TransferReceipt>("/transaction/transfer", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(data),
      }),

    deposit: (data: DepositRequest, idempotencyKey: string = generateUUID()) =>
      request<TransferReceipt>("/transaction/deposit", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(data),
      }),

    withdraw: (data: WithdrawalRequest, idempotencyKey: string = generateUUID()) =>
      request<TransferReceipt>("/transaction/withdraw", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(data),
      }),

    requestCardless: (data: {
      account_id: number;
      amount: number;
      pin: string;
      currency?: string;
      atm_id?: number;
      phone_number?: string;
    }) =>
      request<CardlessWithdrawalTicket>("/transaction/withdraw/request", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    claimAtATM: async (atmId: number, phoneNumber: string, code: string) => {
      // Calls the ATM simulation server directly at http://localhost:808X/atm/claim
      const port = 8080 + atmId;
      const res = await fetch(`http://localhost:${port}/atm/claim`, {
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
  },

  ledger: {
    getStatement: (accountId: number, limit: number = 20, offset: number = 0) =>
      request<LedgerEntry[]>(
        `/ledger/statement/${accountId}?limit=${limit}&offset=${offset}`,
        { method: "GET" }
      ),

    getJournal: (journalId: string) =>
      request<JournalEntry>(`/ledger/journal/${journalId}`, { method: "GET" }),
  },
};
