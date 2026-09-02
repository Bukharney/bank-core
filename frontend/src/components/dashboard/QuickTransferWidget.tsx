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
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/90 p-5 sm:p-6 shadow-sm space-y-4 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Transfer</h3>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          From #{activeAccount?.id}
        </span>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                Recipient Account
              </label>
              <span
                className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded ${
                  quickReceiverId.replace(/\D/g, "").length === 10
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
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
                className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
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
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-white focus:outline-none"
            />
            {quickVerifying && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            )}
          </div>

          {quickRecipientAccount && (
            <div className="mt-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300 animate-slide-up">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-900 dark:text-white">
                  {quickRecipientAccount.account_holder_name || "Verified Customer"}
                </span>
                <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                  Active
                </span>
              </div>
              <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                Account #{quickRecipientAccount.id} • {formatAccountNumber(quickRecipientAccount.account_number)}
              </div>
            </div>
          )}

          {quickRecipientError && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{quickRecipientError}</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
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
              className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm font-mono ${
                isOverBalance ? "text-rose-500" : "text-slate-400"
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
              className={`w-full rounded-xl border py-2 pl-7 pr-3 text-base font-bold font-mono transition-all focus:outline-none ${
                isOverBalance
                  ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-white"
              }`}
            />
          </div>

          {/* Quick amount shortage warning */}
          {isOverBalance && activeAccount && (
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-rose-600 dark:text-rose-400 font-medium">
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
          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white py-2.5 text-xs font-semibold text-white dark:text-slate-900 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition disabled:opacity-50"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            {isOverBalance ? "Insufficient Balance" : "Review Transfer"}
          </span>
        </button>
      </form>
    </div>
  );
}
