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
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/90 p-5 sm:p-6 shadow-sm space-y-3 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Activity</h3>
        </div>
        <Link
          href="/ledger"
          className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1"
        >
          <span>Ledger</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {recentTransactions.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400">
          No recent transactions recorded.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {recentTransactions.slice(0, 5).map((tx) => {
            const isCredit = tx.entry_type === "CREDIT";
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs ${
                      isCredit
                        ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {isCredit ? (
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {isCredit ? "Deposit / Inflow" : "Transfer / Outflow"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatDate(tx.created_at)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-xs font-bold font-mono ${
                      isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {isCredit ? "+" : "-"}
                    {formatMoney(tx.amount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
