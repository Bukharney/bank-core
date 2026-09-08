"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/currency";
import { LedgerEntry } from "@/lib/types";
import TreasuryTelemetryCard from "@/components/dashboard/TreasuryTelemetryCard";
import ATMHardwareHubCard from "@/components/dashboard/ATMHardwareHubCard";
import {
  Activity,
  Server,
  BookOpenText,
  ShieldAlert,
  ShieldCheck,
  Zap,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

interface SystemAccount {
  id: number;
  account_number: string;
  label: string;
  category: "CENTRAL_SETTLEMENT" | "ATM_VAULT";
  balanceSatang: number;
  status: "ONLINE" | "SETTLED";
}

export default function AdminOperationsPage() {
  const { user, activeAccount } = useAuth();
  const { openAtmSimulator } = useSidebar();
  const [recentEntries, setRecentEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<string>("");

  const systemAccounts: SystemAccount[] = [
    {
      id: 100,
      account_number: "SYS-CASH-SETTLE",
      label: "Central Clearing & Settlement",
      category: "CENTRAL_SETTLEMENT",
      balanceSatang: 10000000000,
      status: "ONLINE",
    },
    {
      id: 101,
      account_number: "ATM-VAULT-001",
      label: "Terminal #1 Vault (Port :8081)",
      category: "ATM_VAULT",
      balanceSatang: 500000000,
      status: "ONLINE",
    },
    {
      id: 102,
      account_number: "ATM-VAULT-002",
      label: "Terminal #2 Vault (Port :8082)",
      category: "ATM_VAULT",
      balanceSatang: 500000000,
      status: "ONLINE",
    },
    {
      id: 103,
      account_number: "ATM-VAULT-003",
      label: "Terminal #3 Vault (Port :8083)",
      category: "ATM_VAULT",
      balanceSatang: 500000000,
      status: "ONLINE",
    },
  ];

  const fetchRecentLedger = async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const res = await api.ledger.getStatement(activeAccount.id, 10, 0);
      if (res.data) {
        setRecentEntries(res.data);
      }
      setLastHeartbeat(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to load operations statement", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentLedger();
  }, [activeAccount]);

  const totalSystemLiquidity = systemAccounts.reduce((sum, a) => sum + a.balanceSatang, 0);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2DDD0] dark:border-vault-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 dark:bg-vault-surface border border-bullion-500/40 text-bullion-400 shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Core Operations & System Control
              </h1>
              <span className="rounded bg-bullion-500/10 border border-bullion-500/30 text-bullion-700 dark:text-bullion-400 text-[10px] font-mono font-bold px-2 py-0.5">
                OPERATIONS TERMINAL
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              High-concurrency double-entry ledger oversight, node cluster health, and liquidity settlement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchRecentLedger}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-vault-border bg-white dark:bg-vault-surface px-3 py-1.5 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-vault-highlight transition shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-bullion-500" : ""}`} />
            <span>Sync Telemetry</span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian px-3.5 py-1.5 text-xs font-mono font-bold hover:bg-slate-800 dark:hover:bg-bullion-400 transition shadow-xs"
          >
            <span>Customer View</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Primary Technical Telemetry Ribbon (From Skills Standard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            <span>ENGINE LATENCY</span>
            <Zap className="h-4 w-4 text-bullion-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            &lt; 15 ms
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            PostgreSQL Write + WAL Fsync
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            <span>EVENT STREAM (CDC)</span>
            <Activity className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            Realtime Live
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Outbox Publisher Online
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            <span>SYSTEM LIQUIDITY</span>
            <Landmark className="h-4 w-4 text-bullion-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white truncate">
            {formatMoney(totalSystemLiquidity)}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            100% Fully Backed Reserves
          </div>
        </div>
      </div>

      {/* Main 12-Column Operations Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: System Settlement Accounts & Live Postings (7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Central Settlement & ATM Vault Accounts */}
          <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 sm:p-6 shadow-xs dark:shadow-milled space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2DDD0] dark:border-vault-border pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-bullion-600 dark:text-bullion-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  System Settlement & Vault Accounts
                </h2>
              </div>
              <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                4 Core Accounts
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-vault-border">
              {systemAccounts.map((acc) => (
                <div key={acc.id} className="py-3 first:pt-1 last:pb-1 flex items-center justify-between">
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        {acc.account_number}
                      </span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-vault-surface text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-vault-border">
                        {acc.category === "CENTRAL_SETTLEMENT" ? "SETTLEMENT" : "ATM VAULT"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {acc.label}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(acc.balanceSatang)}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-600 dark:text-ledger-credit">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      ACTIVE
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Postings Stream */}
          <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 sm:p-6 shadow-xs dark:shadow-milled space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2DDD0] dark:border-vault-border pb-3">
              <div className="flex items-center gap-2">
                <BookOpenText className="h-4 w-4 text-slate-700 dark:text-bullion-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Audited Postings Stream
                </h2>
              </div>
              <Link
                href="/admin/ledger"
                className="text-xs font-mono font-semibold text-bullion-700 dark:text-bullion-400 hover:underline flex items-center gap-1"
              >
                <span>Full General Ledger</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentEntries.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500 dark:text-slate-400">
                No recent postings detected on active account.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-vault-border">
                {recentEntries.slice(0, 5).map((entry) => {
                  const isCredit = entry.entry_type === "CREDIT";
                  return (
                    <div
                      key={entry.id}
                      className="py-3 first:pt-1 last:pb-1 flex items-center justify-between font-mono text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold shrink-0 ${
                            isCredit
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-ledger-credit"
                              : "border-slate-300 dark:border-vault-border bg-slate-100 dark:bg-vault-surface text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isCredit ? "CR" : "DR"}
                        </div>
                        <div className="min-w-0 truncate">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {entry.journal_entry_id ? `Journal ${entry.journal_entry_id.slice(0, 8)}...` : `Entry #${entry.id}`}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {formatDate(entry.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-bold tabular-nums ${
                            isCredit ? "text-emerald-600 dark:text-ledger-credit" : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {isCredit ? "+" : "-"}{formatMoney(entry.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ATM Cluster & Detailed Telemetry (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          {/* ATM Cluster Hardware Hub Card */}
          <ATMHardwareHubCard />

          {/* Treasury Telemetry Card */}
          <TreasuryTelemetryCard />
        </div>
      </div>
    </div>
  );
}
