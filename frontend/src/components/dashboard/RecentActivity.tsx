"use client";

import React from "react";
import Link from "next/link";
import { LedgerEntry } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/currency";
import { Activity, ChevronRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface RecentActivityProps {
  recentTransactions: LedgerEntry[];
}

export default function RecentActivity({ recentTransactions }: RecentActivityProps) {
  return (
    <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 sm:p-6 shadow-xs dark:shadow-milled space-y-3 transition-colors duration-300">
      <div className="flex items-center justify-between border-b border-[#E2DDD0] dark:border-vault-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#F7F5EE] dark:bg-vault-surface text-slate-700 dark:text-bullion-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
              Recent Transactions
            </h3>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              Latest Activity
            </span>
          </div>
        </div>
        <Link
          href="/ledger"
          className="text-xs font-mono font-semibold text-slate-600 dark:text-bullion-400 hover:text-slate-900 dark:hover:text-bullion-300 transition flex items-center gap-1"
        >
          <span>View All</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {recentTransactions.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-vault-border bg-slate-50/50 dark:bg-vault-surface/30 space-y-3">
          <div className="mx-auto w-8 h-8 rounded-full bg-slate-100 dark:bg-vault-surface flex items-center justify-center text-slate-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              No Transactions Yet
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm mx-auto font-mono">
              Send money or deposit cash to see your transactions recorded here.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link
              href="/transfer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian text-xs font-mono font-bold hover:bg-slate-800 dark:hover:bg-bullion-400 transition"
            >
              <ArrowUpRight className="h-3 w-3" />
              <span>Send Money</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#E2DDD0]/60 dark:divide-vault-border">
          {recentTransactions.slice(0, 6).map((tx) => {
            const isCredit = tx.entry_type === "CREDIT";
            return (
              <Link
                key={tx.id}
                href="/ledger"
                className="flex items-center justify-between py-3 first:pt-1 last:pb-1 group hover:bg-slate-50/70 dark:hover:bg-vault-surface/50 px-2 rounded-xl transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs shrink-0 font-mono shadow-2xs ${
                      isCredit
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-ledger-credit"
                        : "border-slate-300 dark:border-vault-border bg-slate-100 dark:bg-vault-surface text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {isCredit ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 truncate">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-bullion-600 dark:group-hover:text-bullion-400 transition-colors">
                      {isCredit ? "Money Received" : "Money Sent"}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                      <span>{formatDate(tx.created_at)}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        Ref #{tx.id}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-3">
                  <div
                    className={`text-sm font-bold font-mono tabular-nums ${
                      isCredit
                        ? "text-emerald-600 dark:text-ledger-credit"
                        : "text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {isCredit ? "+" : "-"}
                    {formatMoney(tx.amount)}
                  </div>
                  <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    SETTLED • {tx.entry_type}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
