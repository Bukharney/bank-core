export interface User {
  id: string;
  username: string;
  email: string;
  phone_number?: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  has_pin?: boolean;
  pin_failed_attempts?: number;
  created_at: string;
}

export interface Account {
  id: number;
  account_number: string;
  user_id: string;
  account_holder_name?: string;
  currency: string;
  account_type: "SAVINGS" | "CHECKING" | "SYSTEM_SETTLEMENT" | "INTERNAL";
  status: "ACTIVE" | "FROZEN" | "CLOSED";
  balance: number; // In minor unit (Satang)
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AccountPreview {
  id: number;
  account_number: string;
  account_holder_name?: string;
  currency: string;
  account_type: "SAVINGS" | "CHECKING" | "SYSTEM_SETTLEMENT" | "INTERNAL";
  status: "ACTIVE" | "FROZEN" | "CLOSED";
}

export interface TransferRequest {
  sender_account_id: number;
  receiver_account_id: number;
  amount: number; // In minor unit (Satang)
  currency: string;
  description?: string;
  pin?: string;
}

export interface DepositRequest {
  account_id: number;
  amount: number; // In minor unit (Satang)
  currency: string;
  deposit_ref: string;
  description?: string;
}

export interface WithdrawalRequest {
  account_id: number;
  amount: number; // In minor unit (Satang)
  currency: string;
  atm_id: number;
  withdrawal_ref: string;
  description?: string;
}

export interface CardlessWithdrawalTicket {
  order_id: string;
  account_id: number;
  phone_number: string;
  code: string;
  amount: number;
  currency: string;
  atm_id: number;
  expires_in_seconds: number;
  expires_at: string;
}

export interface ClaimResponse {
  status: string;
  customer_name?: string;
  amount?: number;
  currency?: string;
  message: string;
}

export interface TransferReceipt {
  journal_id: string;
  reference_id: string;
  sender_account_id: number;
  receiver_account_id: number;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  journal_entry_id: string;
  account_id: number;
  entry_type: "DEBIT" | "CREDIT";
  amount: number; // In minor unit (Satang)
  balance_after: number;
  sequence: number;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  reference_id: string;
  transaction_type: string;
  description: string;
  status: string;
  posted_at: string;
  created_at: string;
  postings?: LedgerEntry[];
}
