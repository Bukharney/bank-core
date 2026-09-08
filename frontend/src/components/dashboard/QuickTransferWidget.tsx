"use client";

import React from "react";
import { Account, AccountPreview } from "@/lib/types";
import { formatAccountNumber, formatMoney, thbToSatang } from "@/lib/currency";
import { getAccountMeta } from "@/lib/accountMeta";
import { ArrowLeftRight, Loader2, XCircle, ShieldCheck } from "lucide-react";

interface QuickTransferWidgetProps {
  activeAccount: Account | null;
  otherOwnAccounts: Account[];
  quickReceiverId: string;
  quickAmount: string;
  quickRecipientAccount: AccountPreview | null;
  quickVerifying: boolean;
  quickRecipientError: string | null;
  onReceiverIdChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function QuickTransferWidget({
  activeAccount,
  otherOwnAccounts,
  quickReceiverId,
  quickAmount,
  quickRecipientAccount,
  quickVerifying,
  quickRecipientError,
  onReceiverIdChange,
  onAmountChange,
  onSubmit,
}: QuickTransferWidgetProps) {
  const isOverBalance = Boolean(
    activeAccount && thbToSatang(quickAmount) > activeAccount.balance
  );

  return (
    <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 sm:p-6 shadow-xs dark:shadow-milled space-y-4 transition-colors duration-300">
      <div className="flex items-center justify-between border-b border-[#E2DDD0] dark:border-vault-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#F7F5EE] dark:bg-vault-surface text-slate-700 dark:text-bullion-400">
            <ArrowLeftRight className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
              Quick Send Money
            </h3>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              Instant Transfer
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-vault-surface text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-vault-border">
          From #{activeAccount?.id}
        </span>
      </div>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Recipient Account
              </label>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  quickReceiverId.replace(/\D/g, "").length === 10
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-ledger-credit border border-emerald-500/20"
                    : "bg-slate-100 dark:bg-vault-surface text-slate-500 dark:text-slate-400"
                }`}
              >
                {quickReceiverId.replace(/\D/g, "").length}/10
              </span>
            </div>
            {otherOwnAccounts.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onReceiverIdChange(e.target.value);
                  }
                }}
                value=""
                className="rounded-md border border-slate-200 dark:border-vault-border bg-slate-50 dark:bg-vault-surface px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300 focus:outline-none focus:border-bullion-500"
              >
                <option value="">⚡ My Accounts</option>
                {otherOwnAccounts.map((own) => {
                  const ownMeta = getAccountMeta(own.id);
                  return (
                    <option key={own.id} value={own.account_number}>
                      {ownMeta.nickname || `${own.account_type} #${own.id}`} ({formatAccountNumber(own.account_number)})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              required
              maxLength={14}
              placeholder="XXX-X-XXXXX-X (10 digits)"
              value={quickReceiverId}
              onChange={(e) => onReceiverIdChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2.5 px-3 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-500 focus:outline-none transition-colors"
            />
            {quickVerifying && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-bullion-500" />
              </div>
            )}
          </div>

          {quickRecipientAccount && (
            <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-50/80 dark:bg-vault-surface p-2.5 text-[11px] text-emerald-800 dark:text-ledger-credit animate-slide-up">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-900 dark:text-white">
                  {quickRecipientAccount.account_holder_name || "Verified Account"}
                </span>
                <span className="text-[9px] font-mono uppercase font-bold text-emerald-700 dark:text-ledger-credit bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  VERIFIED
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                Account #{quickRecipientAccount.id} • {formatAccountNumber(quickRecipientAccount.account_number)}
              </div>
            </div>
          )}

          {quickRecipientError && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-ledger-debit font-mono">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{quickRecipientError}</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Amount (THB)
            </label>
            {activeAccount && (
              <span className="text-[10px] text-slate-500 font-mono">
                Max: {formatMoney(activeAccount.balance, activeAccount.currency)}
              </span>
            )}
          </div>
          <div className="relative">
            <span
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm font-mono ${
                isOverBalance ? "text-rose-500" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              ฿
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={quickAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              className={`w-full rounded-xl border py-2.5 pl-8 pr-3 text-base font-bold font-mono transition-all focus:outline-none ${
                isOverBalance
                  ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-600 dark:text-ledger-debit"
                  : "border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-500"
              }`}
            />
          </div>

          {/* Quick Amount Chips */}
          <div className="flex items-center gap-1.5 mt-2">
            {[100, 500, 1000, 5000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onAmountChange(preset.toString())}
                className="flex-1 py-1 rounded-lg border border-slate-200/80 dark:border-vault-border bg-slate-50 dark:bg-vault-surface text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-vault-highlight transition-colors"
              >
                +{preset.toLocaleString()}
              </button>
            ))}
            {activeAccount && (
              <button
                type="button"
                onClick={() => onAmountChange((activeAccount.balance / 100).toString())}
                className="px-2 py-1 rounded-lg border border-bullion-500/30 bg-bullion-500/10 text-[10px] font-mono font-bold text-bullion-700 dark:text-bullion-400 hover:bg-bullion-500/20 transition-colors"
              >
                MAX
              </button>
            )}
          </div>

          {/* Quick amount shortage warning */}
          {isOverBalance && activeAccount && (
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-rose-600 dark:text-ledger-debit font-medium">
              <span>⚠️ Exceeds balance by {formatMoney(thbToSatang(quickAmount) - activeAccount.balance, activeAccount.currency)}</span>
              <button
                type="button"
                onClick={() => onAmountChange((activeAccount.balance / 100).toString())}
                className="font-bold underline text-rose-700 dark:text-rose-300"
              >
                Use Max
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={
            !quickRecipientAccount ||
            !quickAmount ||
            (activeAccount ? thbToSatang(quickAmount) > activeAccount.balance : false)
          }
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-bullion-500 py-2.5 text-xs font-bold text-white dark:text-vault-obsidian shadow-sm hover:bg-slate-800 dark:hover:bg-bullion-400 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>
            {isOverBalance ? "Insufficient Balance" : "Review & Send"}
          </span>
        </button>
      </form>
    </div>
  );
}
