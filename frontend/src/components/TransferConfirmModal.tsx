"use client";

import React from "react";
import { Account, AccountPreview } from "@/lib/types";
import { formatMoney, formatAccountNumber } from "@/lib/currency";
import { getAccountMeta } from "@/lib/accountMeta";
import {
  X,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  User,
} from "lucide-react";

interface TransferConfirmModalProps {
  isOpen: boolean;
  senderAccount: Account | null;
  receiverAccount: Account | AccountPreview | null;
  amountSatang: number;
  description?: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function TransferConfirmModal({
  isOpen,
  senderAccount,
  receiverAccount,
  amountSatang,
  description,
  loading,
  onClose,
  onConfirm,
}: TransferConfirmModalProps) {
  if (!isOpen || !senderAccount || !receiverAccount) return null;

  const senderMeta = getAccountMeta(senderAccount.id);
  const receiverMeta = getAccountMeta(receiverAccount.id);

  const recipientDisplayName =
    receiverAccount.account_holder_name || receiverMeta.nickname || "Verified Bank Customer";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md my-auto max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200/80 dark:border-vault-border bg-white dark:bg-vault-card p-6 sm:p-8 shadow-2xl animate-slide-up space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-vault-surface text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 dark:bg-vault-surface border border-bullion-500/40 text-bullion-400 shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Authorize Vault Transfer
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Verify counterparty settlement routing before cryptographic authorization.
          </p>
        </div>

        {/* Amount Box */}
        <div className="rounded-xl border border-slate-200 dark:border-vault-border bg-slate-50 dark:bg-vault-surface p-4 text-center">
          <div className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Total Debit Amount
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono mt-1 tracking-tight tabular-nums">
            {formatMoney(amountSatang, senderAccount.currency)}
          </div>
        </div>

        {/* Route Details Card */}
        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface/40 p-4 text-xs font-mono">
          {/* Source Account */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-vault-border">
            <span className="text-slate-500 dark:text-slate-400">Debit Vault</span>
            <div className="text-right">
              <div className="font-bold text-slate-900 dark:text-white">
                {senderMeta.nickname || `${senderAccount.account_type} #${senderAccount.id}`}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {formatAccountNumber(senderAccount.account_number)}
              </div>
            </div>
          </div>

          {/* Destination Account with Full Recipient Name */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-vault-border">
            <span className="text-slate-500 dark:text-slate-400">Credit Recipient</span>
            <div className="text-right">
              <div className="font-bold text-slate-900 dark:text-white flex items-center justify-end gap-1.5">
                <span className="text-emerald-600 dark:text-ledger-credit font-bold">{recipientDisplayName}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Account #{receiverAccount.id} • {formatAccountNumber(receiverAccount.account_number)}
              </div>
            </div>
          </div>

          {/* Fee */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-vault-border">
            <span className="text-slate-500 dark:text-slate-400">Ledger Fee</span>
            <span className="text-emerald-600 dark:text-ledger-credit font-bold">฿0.00 (Core Free)</span>
          </div>

          {/* Note */}
          {description && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Memo</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{description}</span>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          <Lock className="h-3 w-3 text-bullion-500" />
          <span>Double-Entry Atomic Invariant Enforced</span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-bullion-500 py-3.5 text-sm font-bold text-white dark:text-vault-obsidian shadow-sm hover:bg-slate-800 dark:hover:bg-bullion-400 active:scale-[0.98] transition dark:shadow-bullion-glow disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Executing Transfer...</span>
              </>
            ) : (
              <>
                <span>Confirm & Dispatch Money</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full rounded-xl py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition font-mono"
          >
            Cancel / Edit Details
          </button>
        </div>
      </div>
    </div>
  );
}
