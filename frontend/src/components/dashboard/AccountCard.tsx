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
  const colorPreset = COLOR_PRESETS[meta.color] || COLOR_PRESETS.bullion;

  return (
    <div
      onClick={() => onSelect(account)}
      className={`group relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-5 transition-all duration-300 cursor-pointer ${
        isSelected
          ? `bg-white dark:bg-vault-surface border-2 ${colorPreset.activeBorderLight} ${colorPreset.activeBorderDark} ${colorPreset.activeRing} text-slate-900 dark:text-white shadow-md dark:shadow-bullion-glow`
          : "bg-white dark:bg-vault-card/70 border border-slate-200/90 dark:border-vault-border hover:border-slate-300 dark:hover:border-vault-highlight shadow-xs dark:shadow-milled hover:shadow-sm"
      }`}
    >
      {/* Decorative Subtle Background Micro-Watermark */}
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-radial from-bullion-500/5 to-transparent pointer-events-none opacity-40" />

      <div className="space-y-2 min-w-0 relative z-10">
        <div className="flex items-center gap-2.5">
          {/* Simulated EMV Smart Chip */}
          <div className={`w-6 h-4.5 rounded-[3px] bg-gradient-to-br ${colorPreset.chip} border flex items-center justify-center shadow-xs shrink-0`}>
            <div className="w-3.5 h-2.5 border border-black/20 rounded-[1px] grid grid-cols-2 gap-0.5">
              <div className="border-r border-black/20" />
              <div />
            </div>
          </div>

          <span className="text-sm font-bold truncate text-slate-900 dark:text-white">
            {meta.nickname || `${account.account_type} Vault`}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(account);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-vault-elevated transition"
            title="Customize Account Name & Color"
          >
            <Pencil className="h-3 w-3" />
          </button>

          {isSelected ? (
            <span className={`rounded-full ${colorPreset.badge} text-[9px] font-mono font-bold px-2 py-0.5 shrink-0`}>
              PRIMARY • {colorPreset.id.toUpperCase()}
            </span>
          ) : (
            <span className="text-[9px] font-mono text-slate-400 uppercase">
              {colorPreset.name.replace(/^(Sovereign|Alpine|Billet|Vault|Reserve)\s+/i, "")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span className="tracking-wider">
            {formatAccountNumber(account.account_number)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(account);
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition hover:bg-slate-100 dark:hover:bg-vault-elevated"
            title="Copy Account Number"
          >
            {copiedId === account.id ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 relative z-10">
        <div className="text-right">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Available Ledger
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums text-slate-900 dark:text-white">
            {hideBalance ? "••••••••" : formatMoney(account.balance, account.currency)}
          </div>
          <div className="flex items-center justify-end gap-1 text-[10px] font-mono text-emerald-600 dark:text-ledger-credit">
            <span className={`h-1.5 w-1.5 rounded-full ${colorPreset.dot} inline-block animate-pulse`} />
            <span>{account.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
