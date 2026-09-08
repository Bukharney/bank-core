"use client";

import React from "react";
import Link from "next/link";
import { Account, User } from "@/lib/types";
import { formatAccountNumber, formatMoney } from "@/lib/currency";
import { getAccountMeta, COLOR_PRESETS } from "@/lib/accountMeta";
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
} from "lucide-react";

interface QuickActionsProps {
  currentAccount: Account | null;
  user: User | null;
  hideBalance: boolean;
  onToggleHideBalance: () => void;
  onDeposit: (account: Account | null) => void;
  onWithdraw: (account: Account | null) => void;
}

export default function QuickActions({
  currentAccount,
  user,
  hideBalance,
  onToggleHideBalance,
  onDeposit,
  onWithdraw,
}: QuickActionsProps) {
  const currentBalanceSatang = currentAccount?.balance || 0;
  const currentCurrency = currentAccount?.currency || "THB";
  const currentMeta = currentAccount ? getAccountMeta(currentAccount.id) : null;
  const currentColorPreset = currentMeta
    ? COLOR_PRESETS[currentMeta.color] || COLOR_PRESETS.bullion
    : COLOR_PRESETS.bullion;
  const currentAccountLabel =
    currentMeta?.nickname ||
    (currentAccount
      ? `${currentAccount.account_type} #${currentAccount.id}`
      : "Account");

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-gradient-to-br dark:from-vault-surface dark:via-vault-card dark:to-vault-surface p-6 sm:p-8 shadow-xs dark:shadow-card-depth transition-all duration-300"
    >
      {/* Background Guilloché rosette pattern */}
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border border-bullion-500/10 bg-rosette-seal pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <span className="h-2 w-2 rounded-full bg-bullion-500 shrink-0" />
            <span>Available Balance • {currentAccountLabel}</span>
            <button
              onClick={onToggleHideBalance}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-bullion-300 transition ml-1"
              title={hideBalance ? "Show Balance" : "Hide Balance"}
            >
              {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
              {hideBalance ? "••••••••" : formatMoney(currentBalanceSatang, currentCurrency)}
            </h1>
            <span
              className="rounded-lg bg-bullion-500/10 text-bullion-700 dark:text-bullion-400 border border-bullion-500/30 px-2 py-0.5 text-xs font-bold font-mono"
            >
              {currentCurrency} ฿
            </span>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 flex flex-wrap items-center gap-x-2.5 font-mono">
            <span>
              Acc:{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {currentAccount ? formatAccountNumber(currentAccount.account_number) : ""}
              </span>
            </span>
            <span className="text-slate-300 dark:text-vault-border">•</span>
            <span>
              Holder:{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {user?.first_name} {user?.last_name}
              </span>
            </span>
            <span className="text-slate-300 dark:text-vault-border">•</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-ledger-credit font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Protected & Verified
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/transfer"
            className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-bullion-500 hover:bg-slate-800 dark:hover:bg-bullion-400 px-4 py-2.5 text-xs sm:text-sm font-bold text-white dark:text-vault-obsidian active:scale-95 transition shadow-xs dark:shadow-bullion-glow"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Send Money</span>
          </Link>

          <button
            onClick={() => onDeposit(currentAccount)}
            className="flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-vault-border bg-white dark:bg-vault-surface px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-vault-highlight active:scale-95 transition shadow-xs"
          >
            <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-ledger-credit" />
            <span>Deposit</span>
          </button>

          <button
            onClick={() => onWithdraw(currentAccount)}
            className="flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-vault-border bg-white dark:bg-vault-surface px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-vault-highlight active:scale-95 transition shadow-xs"
          >
            <ArrowUpRight className="h-4 w-4 text-bullion-500" />
            <span>Cash Out / ATM</span>
          </button>
        </div>
      </div>
    </div>
  );
}
