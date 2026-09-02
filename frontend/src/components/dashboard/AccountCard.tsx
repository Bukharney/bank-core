"use client";

import React from "react";
import { Account } from "@/lib/types";
import { formatAccountNumber, formatMoney } from "@/lib/currency";
import { getAccountMeta, COLOR_PRESETS } from "@/lib/accountMeta";
import { Copy, Check, Pencil } from "lucide-react";

interface AccountCardProps {
  account: Account;
  isSelected: boolean;
  hideBalance: boolean;
  copiedId: number | null;
  onSelect: (account: Account) => void;
  onCopy: (account: Account) => void;
  onEdit: (account: Account) => void;
}

export default function AccountCard({
  account,
  isSelected,
  hideBalance,
  copiedId,
  onSelect,
  onCopy,
  onEdit,
}: AccountCardProps) {
  const meta = getAccountMeta(account.id);
  const colorPreset = COLOR_PRESETS[meta.color] || COLOR_PRESETS.slate;

  return (
    <div
      onClick={() => onSelect(account)}
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-5 transition-all cursor-pointer ${colorPreset.bgLight} ${colorPreset.bgDark} ${
        isSelected
          ? `${colorPreset.activeBorderLight} ${colorPreset.activeBorderDark} ${colorPreset.activeRing}`
          : `${colorPreset.borderLight} ${colorPreset.borderDark} hover:border-slate-300 dark:hover:border-slate-700 shadow-sm`
      }`}
    >
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${colorPreset.dot} shrink-0`} />
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {meta.nickname || `${account.account_type} Account`}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(account);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Customize Account Name & Color"
          >
            <Pencil className="h-3 w-3" />
          </button>
          {isSelected && (
            <span className={`rounded-full ${colorPreset.activeBadge} text-[9px] font-bold px-2 py-0.5 shrink-0 shadow-xs`}>
              ACTIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span>#{account.id} • {formatAccountNumber(account.account_number)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(account);
            }}
            className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
            title="Copy Account Number"
          >
            {copiedId === account.id ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
        <div className="text-right">
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {hideBalance ? "••••••••" : formatMoney(account.balance, account.currency)}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            ● {account.status}
          </div>
        </div>
      </div>
    </div>
  );
}
