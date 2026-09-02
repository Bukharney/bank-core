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
    ? COLOR_PRESETS[currentMeta.color] || COLOR_PRESETS.slate
    : COLOR_PRESETS.slate;
  const currentAccountLabel =
    currentMeta?.nickname ||
    (currentAccount
      ? `${currentAccount.account_type} #${currentAccount.id}`
      : "Account");

  return (
    <div
      className={`rounded-3xl border ${currentColorPreset.borderLight} ${currentColorPreset.borderDark} ${currentColorPreset.bgLight} ${currentColorPreset.bgDark} p-6 sm:p-8 shadow-sm transition-all duration-300`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span className={`h-2.5 w-2.5 rounded-full ${currentColorPreset.dot} shrink-0`} />
            <span>Available Balance • {currentAccountLabel}</span>
            <button
              onClick={onToggleHideBalance}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition ml-1"
              title={hideBalance ? "Show Balance" : "Hide Balance"}
            >
              {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
              {hideBalance ? "••••••••" : formatMoney(currentBalanceSatang, currentCurrency)}
            </h1>
            <span
              className={`rounded-lg ${currentColorPreset.badge} px-2 py-0.5 text-xs font-bold font-mono border`}
            >
              {currentCurrency}
            </span>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 pt-0.5 flex flex-wrap items-center gap-x-2">
            <span>
              Account:{" "}
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {currentAccount ? formatAccountNumber(currentAccount.account_number) : ""}
              </span>
            </span>
            <span>•</span>
            <span>
              Customer:{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {user?.first_name} {user?.last_name}
              </span>
            </span>
            <span>•</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium font-mono">
              Verified Active Status
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/transfer"
            className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition shadow-sm"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Transfer</span>
          </Link>

          <button
            onClick={() => onDeposit(currentAccount)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition shadow-sm"
          >
            <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Deposit</span>
          </button>

          <button
            onClick={() => onWithdraw(currentAccount)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition shadow-sm"
          >
            <ArrowUpRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Cardless ATM</span>
          </button>
        </div>
      </div>
    </div>
  );
}
