"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSidebar } from "@/context/SidebarContext";
import { formatMoney } from "@/lib/currency";
import {
  Server,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Zap,
  Play,
  ArrowLeft,
  Banknote,
  Sliders,
  Radio,
} from "lucide-react";

interface ATMNode {
  id: number;
  name: string;
  port: number;
  vaultAccount: string;
  cashLevelSatang: number;
  cassetteStatus: "NORMAL" | "LOW" | "CRITICAL";
  cdmReady: boolean;
  dispenserArmed: boolean;
  uptime: string;
}

export default function AdminNodesPage() {
  const { openAtmSimulator } = useSidebar();
  const [refreshing, setRefreshing] = useState(false);

  const nodes: ATMNode[] = [
    {
      id: 1,
      name: "Terminal ATM-01",
      port: 8081,
      vaultAccount: "ATM-VAULT-001 (#101)",
      cashLevelSatang: 500000000,
      cassetteStatus: "NORMAL",
      cdmReady: true,
      dispenserArmed: true,
      uptime: "99.98%",
    },
    {
      id: 2,
      name: "Terminal ATM-02",
      port: 8082,
      vaultAccount: "ATM-VAULT-002 (#102)",
      cashLevelSatang: 500000000,
      cassetteStatus: "NORMAL",
      cdmReady: true,
      dispenserArmed: true,
      uptime: "99.95%",
    },
    {
      id: 3,
      name: "Terminal ATM-03",
      port: 8083,
      vaultAccount: "ATM-VAULT-003 (#103)",
      cashLevelSatang: 500000000,
      cassetteStatus: "NORMAL",
      cdmReady: true,
      dispenserArmed: true,
      uptime: "100.00%",
    },
  ];

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const totalVaultCash = nodes.reduce((acc, n) => acc + n.cashLevelSatang, 0);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2DDD0] dark:border-vault-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 dark:bg-vault-surface border border-bullion-500/40 text-bullion-400 shadow-sm">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                ATM Cluster Fleet Monitor
              </h1>
              <span className="rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-ledger-credit text-[10px] font-mono font-bold px-2 py-0.5">
                3 NODES ONLINE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Live hardware port monitoring, cash cassette balances, and physical terminal diagnostics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-vault-border bg-white dark:bg-vault-surface px-3 py-1.5 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-vault-highlight transition shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-bullion-500" : ""}`} />
            <span>Poll Nodes</span>
          </button>

          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian px-3.5 py-1.5 text-xs font-mono font-bold hover:bg-slate-800 dark:hover:bg-bullion-400 transition shadow-xs"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Operations Hub</span>
          </Link>
        </div>
      </div>

      {/* Overview Stat Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>TOTAL FLEET VAULT CASH</span>
            <Banknote className="h-4 w-4 text-emerald-600 dark:text-ledger-credit" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatMoney(totalVaultCash)}
          </div>
          <div className="text-[10px] font-mono text-emerald-600 dark:text-ledger-credit">
            ● 100% Reserved & Audited
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>ACTIVE CLUSTER NODES</span>
            <Radio className="h-4 w-4 text-bullion-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            3 / 3 Healthy
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Ports :8081, :8082, :8083 Online
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>DISPENSER INTEGRITY</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-ledger-credit" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            EPP Keypad Armed
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Two-Phase Motorized Shutter Lock
          </div>
        </div>
      </div>

      {/* Node Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-6 shadow-xs dark:shadow-milled space-y-5 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-vault-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {node.name}
                    </span>
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-vault-surface text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-vault-border">
                      Port :{node.port}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    {node.vaultAccount}
                  </div>
                </div>

                <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-700 dark:text-ledger-credit bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-500/20 px-2 py-0.5 rounded">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE
                </span>
              </div>

              {/* Cash & Cassette Status */}
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-vault-border/50">
                  <span className="text-slate-500 dark:text-slate-400">Vault Balance</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(node.cashLevelSatang)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-vault-border/50">
                  <span className="text-slate-500 dark:text-slate-400">Cash Dispenser</span>
                  <span className="font-semibold text-emerald-600 dark:text-ledger-credit">
                    Armed & Motorized
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-vault-border/50">
                  <span className="text-slate-500 dark:text-slate-400">CDM Deposit</span>
                  <span className="font-semibold text-emerald-600 dark:text-ledger-credit">
                    PromptPay Ready
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 dark:text-slate-400">Cassette Health</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Normal (100% Capacity)
                  </span>
                </div>
              </div>
            </div>

            {/* Launch Simulator Button with exact Node Id */}
            <button
              type="button"
              onClick={() => openAtmSimulator({ showPortSelector: true, initialAtmId: node.id })}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-vault-surface dark:border dark:border-bullion-500/30 hover:bg-slate-800 dark:hover:bg-vault-elevated text-white dark:text-bullion-400 py-2.5 text-xs font-mono font-bold transition shadow-xs"
            >
              <Cpu className="h-3.5 w-3.5 text-bullion-400" />
              <span>Launch Terminal #{node.id} Console</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
