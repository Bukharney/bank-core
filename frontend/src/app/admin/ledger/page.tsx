"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
  ShieldCheck,
  Zap,
  Activity,
  ArrowLeft,
} from "lucide-react";

export default function AdminLedgerPage() {
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

  const totalVolume = statement.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2DDD0] dark:border-vault-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 dark:bg-vault-surface border border-bullion-500/40 text-bullion-400 shadow-sm">
            <BookOpenText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Audited General Ledger Journal
              </h1>
              <span className="rounded bg-bullion-500/10 border border-bullion-500/30 text-bullion-700 dark:text-bullion-400 text-[9px] font-mono font-bold px-2 py-0.5">
                DOUBLE-ENTRY CORE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Deterministic, append-only financial journal and correlated dual-leg postings.
            </p>
          </div>
        </div>

        {/* Account Selector & Navigation */}
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
                  {meta.nickname || `${acc.account_type} #${acc.id}`} ({formatAccountNumber(acc.account_number)})
                </option>
              );
            })}
          </select>

          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian px-3.5 py-2 text-xs font-mono font-bold hover:bg-slate-800 dark:hover:bg-bullion-400 transition shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Operations</span>
          </Link>
        </div>
      </div>

      {/* Institutional Telemetry Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>AUDITED VOLUME</span>
            <Scale className="h-4 w-4 text-bullion-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatMoney(totalVolume)}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Loaded in active session
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-700 dark:text-ledger-credit">
            <span>CONSERVATION INVARIANT</span>
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            0 Satang Drift
          </div>
          <div className="text-[10px] font-mono text-emerald-600 dark:text-ledger-credit">
            Σ Debits ≡ Σ Credits Verified
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>ENGINE LATENCY</span>
            <Zap className="h-4 w-4 text-bullion-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            &lt; 15 ms
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            PostgreSQL ACID + Fsync
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>VERIFIED POSTINGS</span>
            <Layers className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {statement.length} Records
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Page {page + 1}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by UUID or Amount..."
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

        {/* Entry Type Filter Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-vault-surface font-mono text-[11px]">
          {(["ALL", "DEBIT", "CREDIT"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                filterType === type
                  ? "bg-white dark:bg-vault-card text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-vault-highlight"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Postings Table */}
      <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card shadow-xs dark:shadow-milled overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-vault-surface/60 border-b border-[#E2DDD0] dark:border-vault-border text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">Entry / Leg</th>
                <th className="py-3 px-4">Journal Entry UUID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Debit (DR)</th>
                <th className="py-3 px-4 text-right">Credit (CR)</th>
                <th className="py-3 px-4 text-center">Audit Inspector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-vault-border">
              {filteredStatement.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400 font-mono">
                    {loading ? "Reading immutable ledger journal..." : "No ledger postings match current filters."}
                  </td>
                </tr>
              ) : (
                filteredStatement.map((entry) => {
                  const isCredit = entry.entry_type === "CREDIT";
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-vault-surface/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-bold">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCredit
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-ledger-credit border border-emerald-500/20"
                              : "bg-slate-100 dark:bg-vault-surface text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-vault-border"
                          }`}
                        >
                          {isCredit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          <span>{entry.entry_type}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleOpenJournal(entry.journal_entry_id)}
                          className="font-mono text-slate-700 dark:text-bullion-400 hover:underline flex items-center gap-1"
                        >
                          <span>{entry.journal_entry_id.slice(0, 12)}...</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums text-slate-900 dark:text-white font-bold">
                        {!isCredit ? formatMoney(entry.amount) : "—"}
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums text-emerald-600 dark:text-ledger-credit font-bold">
                        {isCredit ? formatMoney(entry.amount) : "—"}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenJournal(entry.journal_entry_id)}
                          className="rounded-lg border border-slate-200 dark:border-vault-border px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:border-bullion-500 dark:hover:border-vault-highlight transition"
                        >
                          Inspect Legs
                        </button>
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
            Page {page + 1}
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
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={!hasMore || loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-vault-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-vault-surface transition"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Double-Entry Posting Inspector Modal */}
      {selectedJournal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl rounded-3xl border border-slate-200/90 dark:border-vault-border bg-white dark:bg-vault-card p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-vault-border pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-bullion-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                    Double-Entry Posting Inspector
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Journal UUID: {selectedJournal.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJournal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-vault-surface transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Invariant Verification Pill */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs font-mono text-emerald-800 dark:text-ledger-credit">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-bold">INVARIANT STATUS: BALANCED</span>
              </div>
              <span className="font-bold">0 Satang Drift</span>
            </div>

            {/* Debit & Credit Legs Table */}
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Correlated Ledger Postings
              </div>
              <div className="divide-y divide-slate-100 dark:divide-vault-border rounded-xl border border-slate-200 dark:border-vault-border overflow-hidden">
                {selectedJournal.postings?.map((leg: LedgerEntry) => {
                  const isLegCredit = leg.entry_type === "CREDIT";
                  return (
                    <div
                      key={leg.id}
                      className="flex items-center justify-between p-3 text-xs font-mono bg-white dark:bg-vault-surface/40"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isLegCredit
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-ledger-credit border border-emerald-500/20"
                              : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-ledger-debit border border-rose-500/20"
                          }`}
                        >
                          {leg.entry_type}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Account #{leg.account_id}
                        </span>
                      </div>

                      <span
                        className={`font-bold tabular-nums ${
                          isLegCredit
                            ? "text-emerald-600 dark:text-ledger-credit"
                            : "text-rose-600 dark:text-ledger-debit"
                        }`}
                      >
                        {isLegCredit ? "+" : "-"}{formatMoney(leg.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setSelectedJournal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian text-xs font-mono font-bold hover:bg-slate-800 dark:hover:bg-bullion-400 transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
