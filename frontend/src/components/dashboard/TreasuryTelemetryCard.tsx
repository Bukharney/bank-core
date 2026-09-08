"use client";

import React from "react";
import { ShieldCheck, Zap, Database, CheckCircle2 } from "lucide-react";

export default function TreasuryTelemetryCard() {
  return (
    <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 sm:p-6 shadow-xs dark:shadow-milled space-y-3.5 transition-colors duration-300">
      <div className="flex items-center justify-between border-b border-[#E2DDD0] dark:border-vault-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#F7F5EE] dark:bg-vault-surface text-slate-700 dark:text-bullion-400 border border-slate-200/80 dark:border-vault-border">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
              Core Ledger Telemetry
            </h3>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              Deterministic Verification & Health
            </span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-ledger-credit bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          INVARIANT OK
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-vault-border bg-slate-50/60 dark:bg-vault-surface/40 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-mono uppercase">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Balance Invariant</span>
          </div>
          <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
            0 Satang Leakage
          </div>
          <div className="text-[9px] font-mono text-slate-400">
            Σ Debits ≡ Σ Credits
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-vault-border bg-slate-50/60 dark:bg-vault-surface/40 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-mono uppercase">
            <Zap className="h-3.5 w-3.5 text-bullion-500" />
            <span>Commit Latency</span>
          </div>
          <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
            &lt; 15ms Latency
          </div>
          <div className="text-[9px] font-mono text-slate-400">
            ACID Local Node
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-vault-border bg-slate-50/60 dark:bg-vault-surface/40 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-mono uppercase">
            <Database className="h-3.5 w-3.5 text-indigo-500" />
            <span>Outbox Worker</span>
          </div>
          <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
            Realtime CDC Stream
          </div>
          <div className="text-[9px] font-mono text-slate-400">
            Transactional Relay
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-vault-border bg-slate-50/60 dark:bg-vault-surface/40 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-mono uppercase">
            <ShieldCheck className="h-3.5 w-3.5 text-bullion-500" />
            <span>Reserve Coverage</span>
          </div>
          <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
            100% Fully Backed
          </div>
          <div className="text-[9px] font-mono text-slate-400">
            Atomic Multi-Vault
          </div>
        </div>
      </div>
    </div>
  );
}
