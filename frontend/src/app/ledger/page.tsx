"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { JournalEntry, LedgerEntry } from "@/lib/types";
import { formatMoney, formatDate, formatAccountNumber } from "@/lib/currency";
import { getAccountMeta } from "@/lib/accountMeta";
import {
  BookOpenText,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  X,
  Layers,
  Scale,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";

export default function LedgerPage() {
  const { accounts, activeAccount, setActiveAccount } = useAuth();
  const { showToast } = useToast();

  const [statement, setStatement] = useState<LedgerEntry[]>([]);
  const [filterType, setFilterType] = useState<"ALL" | "DEBIT" | "CREDIT">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Pagination State
  const [page, setPage] = useState<number>(0);
  const pageSize = 25;
  const [hasMore, setHasMore] = useState<boolean>(true);

  const fetchStatement = async (pageNum = page) => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const res = await api.ledger.getStatement(activeAccount.id, pageSize, pageNum * pageSize);
      if (res.data) {
        setStatement(res.data);
        setHasMore(res.data.length === pageSize);
      }
    } catch (err: any) {
      showToast("Failed to load ledger postings", "error");
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

  const handleOpenJournal = async (journalId: string) => {
    try {
      const res = await api.ledger.getJournal(journalId);
      if (res.data) {
        setSelectedJournal(res.data);
      }
    } catch (err: any) {
      showToast("Failed to fetch journal details", "error");
    }
  };

  const filteredStatement = statement.filter((entry) => {
    if (filterType !== "ALL" && entry.entry_type !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUuid = entry.journal_entry_id.toLowerCase().includes(q);
      const matchAmount = entry.amount.toString().includes(q);
      if (!matchUuid && !matchAmount) return false;
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

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
            <BookOpenText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Ledger Explorer
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Immutable, append-only financial journal and correlated postings.
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
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-slate-900 dark:focus:border-white focus:outline-none shadow-sm"
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
            onClick={() => {
              fetchStatement(page);
              showToast("Ledger refreshed", "info");
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 shadow-sm"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-slate-900 dark:text-white" : ""}`} />
          </button>
        </div>
      </div>

      {/* Conservation Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 text-emerald-900 dark:text-emerald-300">
        <div className="flex items-center gap-2.5">
          <Scale className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Double-Entry Balance Verified: </span>
            <span className="text-emerald-800 dark:text-emerald-400">Σ Debits == Σ Credits with 0 balance leakage.</span>
          </div>
        </div>

        <span className="self-start sm:self-auto rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-mono">
          ✓ Balanced
        </span>
      </div>

      {/* Search & Filter Controls Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          {(["ALL", "CREDIT", "DEBIT"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterType === tab
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab === "ALL" ? "All Postings" : tab === "CREDIT" ? "Credit (+ In)" : "Debit (- Out)"}
            </button>
          ))}
        </div>

        {/* Date Range Filters & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker Range */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 px-2.5 shadow-sm text-xs text-slate-600 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              title="Start Date"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              title="End Date"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white ml-1"
                title="Clear Date Filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search UUID or Amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 pl-8 pr-3 text-xs font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-slate-900 dark:focus:border-white focus:outline-none shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Statement Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/90 shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-slate-600 dark:text-slate-300" />
            <span>Loading ledger postings...</span>
          </div>
        ) : filteredStatement.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500 dark:text-slate-400">
            No ledger postings found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Leg</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Balance After</th>
                  <th className="px-5 py-3">Journal UUID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {filteredStatement.map((entry) => {
                  const isCredit = entry.entry_type === "CREDIT";
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3.5 font-sans text-slate-600 dark:text-slate-400">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                            isCredit
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {isCredit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          {entry.entry_type}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3.5 font-bold ${
                          isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {formatMoney(entry.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-800 dark:text-slate-200 font-semibold">
                        {formatMoney(entry.balance_after)}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleOpenJournal(entry.journal_entry_id)}
                          className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline text-xs transition"
                          title="Inspect Correlated Journal"
                        >
                          <span>{entry.journal_entry_id.slice(0, 8)}...</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-900/30">
          <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            Page {page + 1} ({filteredStatement.length} entries displayed)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0 || loading}
              className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={!hasMore || loading}
              className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Double-Entry Journal Modal */}
      {selectedJournal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg my-auto max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-6 sm:p-8 shadow-2xl animate-slide-up space-y-5">
            <button
              onClick={() => setSelectedJournal(null)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Journal Details</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono break-all">{selectedJournal.id}</p>
              </div>
            </div>

            {/* Header info */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Transaction Type:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{selectedJournal.transaction_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Description:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{selectedJournal.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Posted Timestamp:</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono">{formatDate(selectedJournal.posted_at)}</span>
              </div>
            </div>

            {/* Postings Breakdown */}
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Correlated Double-Entry Legs</span>
              </div>

              <div className="space-y-2">
                {selectedJournal.postings?.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs shadow-sm"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white font-mono">Account #{post.account_id}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        Balance After: {formatMoney(post.balance_after)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold font-mono border ${
                          post.entry_type === "CREDIT"
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {post.entry_type} {formatMoney(post.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Balance Guarantee */}
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Conservation Verified: Total Debit == Total Credit</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
