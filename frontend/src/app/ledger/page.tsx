"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { LedgerEntry } from "@/lib/types";
import { formatMoney, formatDate, formatAccountNumber } from "@/lib/currency";
import { getAccountMeta } from "@/lib/accountMeta";
import {
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function UserStatementPage() {
  const { user, accounts, activeAccount, setActiveAccount } = useAuth();
  const { showToast } = useToast();

  const [statement, setStatement] = useState<LedgerEntry[]>([]);
  const [filterType, setFilterType] = useState<"ALL" | "INFLOW" | "OUTFLOW">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Pagination State
  const [page, setPage] = useState<number>(0);
  const pageSize = 20;
  const [totalEntries, setTotalEntries] = useState<number>(0);

  const fetchStatement = async (pageNum = page) => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const res = await api.ledger.getStatement(activeAccount.id, pageSize, pageNum * pageSize);
      if (res.data) {
        setStatement(res.data.entries ?? []);
        setTotalEntries(res.data.total ?? 0);
      }
    } catch (err: any) {
      showToast("Failed to load account transactions", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    fetchStatement(0);
  }, [activeAccount]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 0) return;
    setPage(newPage);
    fetchStatement(newPage);
  };

  const filteredStatement = statement.filter((entry) => {
    if (filterType === "INFLOW" && entry.entry_type !== "CREDIT") return false;
    if (filterType === "OUTFLOW" && entry.entry_type !== "DEBIT") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = entry.id.toString().includes(q);
      const matchAmount = entry.amount.toString().includes(q);
      if (!matchId && !matchAmount) return false;
    }
    if (startDate) {
      const entryDate = new Date(entry.created_at).toISOString().split("T")[0];
      if (entryDate < startDate) return false;
    }
    if (endDate) {
      const entryDate = new Date(entry.created_at).toISOString().split("T")[0];
      if (entryDate > endDate) return false;
    }
    return true;
  });

  const totalInflow = statement
    .filter((e) => e.entry_type === "CREDIT")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalOutflow = statement
    .filter((e) => e.entry_type === "DEBIT")
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-6xl mx-auto">
      {/* Admin Notice Banner (If user wants double-entry logs) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-vault-border bg-slate-50/80 dark:bg-vault-surface/40 p-4 text-xs font-mono">
        <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
          <ShieldAlert className="h-4 w-4 text-bullion-500 shrink-0" />
          <span>Need raw double-entry debit/credit audit logs?</span>
        </div>
        <Link
          href="/admin/ledger"
          className="flex items-center gap-1 font-bold text-bullion-700 dark:text-bullion-400 hover:underline"
        >
          <span>Open Operator Ledger Terminal</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2DDD0] dark:border-vault-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Account Statement & History
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
              Review all incoming and outgoing payments, deposits, and cash withdrawals.
            </p>
          </div>
        </div>

        {/* Account Selector & Refresh */}
        <div className="flex items-center gap-2">
          <select
            value={activeAccount?.id || ""}
            onChange={(e) => {
              const acc = accounts.find((a) => a.id === Number(e.target.value));
              if (acc) {
                setActiveAccount(acc);
                showToast(`Switched to Account #${acc.id}`, "info");
              }
            }}
            className="rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2 px-3 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 focus:border-bullion-500 focus:outline-none shadow-xs"
          >
            {accounts.map((acc) => {
              const meta = getAccountMeta(acc.id);
              return (
                <option key={acc.id} value={acc.id}>
                  {meta.nickname ? `${meta.nickname} • ` : ""}{acc.account_type} • #{acc.id} ({formatAccountNumber(acc.account_number)})
                </option>
              );
            })}
          </select>

          <button
            type="button"
            onClick={() => {
              fetchStatement(page);
              showToast("Statement refreshed", "info");
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-vault-highlight transition active:scale-95 shadow-xs"
            title="Refresh Transactions"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-bullion-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Friendly Summary Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Money Received (Inflow)</span>
            <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-ledger-credit" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-ledger-credit tabular-nums">
            +{formatMoney(totalInflow)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            Direct Deposits & Received Transfers
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Money Sent (Outflow)</span>
            <ArrowUpRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            -{formatMoney(totalOutflow)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            Sent Transfers & Cash Withdrawals
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Total Transactions</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-ledger-credit" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {statement.length} Records
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            Page {page + 1}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by amount or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-vault-border bg-slate-50 dark:bg-vault-surface text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-bullion-500"
          />
        </div>

        {/* Date Pickers */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-vault-surface border border-slate-200 dark:border-vault-border rounded-xl px-2 py-1">
            <Calendar className="h-3 w-3 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none text-[11px]"
            />
          </div>
          <span className="text-slate-400">to</span>
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-vault-surface border border-slate-200 dark:border-vault-border rounded-xl px-2 py-1">
            <Calendar className="h-3 w-3 text-slate-400" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none text-[11px]"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-vault-surface text-xs font-medium">
          {(["ALL", "INFLOW", "OUTFLOW"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-lg font-semibold transition text-[11px] ${
                filterType === type
                  ? "bg-white dark:bg-vault-card text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-vault-highlight"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {type === "ALL" ? "All" : type === "INFLOW" ? "Received" : "Sent"}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-vault-surface/60 border-b border-[#E2DDD0] dark:border-vault-border text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3.5 px-4 font-mono">Type</th>
                <th className="py-3.5 px-4 font-mono">Reference</th>
                <th className="py-3.5 px-4 font-mono">Date & Time</th>
                <th className="py-3.5 px-4 font-mono text-right">Amount</th>
                <th className="py-3.5 px-4 font-mono text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-vault-border">
              {filteredStatement.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400 font-mono">
                    {loading ? "Loading transactions..." : "No transactions found."}
                  </td>
                </tr>
              ) : (
                filteredStatement.map((entry) => {
                  const isCredit = entry.entry_type === "CREDIT";
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-vault-surface/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold shrink-0 ${
                              isCredit
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-ledger-credit"
                                : "border-slate-300 dark:border-vault-border bg-slate-100 dark:bg-vault-surface text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {isCredit ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {isCredit ? "Money Received" : "Money Sent"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        Ref #{entry.id}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums">
                        <span
                          className={
                            isCredit
                              ? "text-emerald-600 dark:text-ledger-credit"
                              : "text-slate-900 dark:text-white"
                          }
                        >
                          {isCredit ? "+" : "-"}{formatMoney(entry.amount)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 dark:text-ledger-credit bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-500/20 px-2 py-0.5 rounded">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Completed</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-vault-border text-xs font-mono">
          <span className="text-slate-500 dark:text-slate-400">
            {totalEntries === 0
              ? "No entries"
              : `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalEntries)} of ${totalEntries}`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0 || loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-vault-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-vault-surface transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-3 py-1 text-slate-500 dark:text-slate-400">
              Page {page + 1} of {Math.max(Math.ceil(totalEntries / pageSize), 1)}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page + 1 >= Math.ceil(totalEntries / pageSize) || loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-vault-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-vault-surface transition"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
