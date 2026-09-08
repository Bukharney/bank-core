"use client";

import React from "react";
import { useSidebar } from "@/context/SidebarContext";
import { Cpu, ArrowDownCircle, ArrowUpCircle, ExternalLink } from "lucide-react";

export default function ATMHardwareHubCard() {
  const { openAtmSimulator } = useSidebar();

  return (
    <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 sm:p-6 shadow-xs dark:shadow-milled space-y-4 transition-colors duration-300">
      <div className="flex items-center justify-between border-b border-[#E2DDD0] dark:border-vault-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#F7F5EE] dark:bg-vault-surface text-slate-700 dark:text-bullion-400 border border-slate-200/80 dark:border-vault-border">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
              ATM & CDM Hardware Nodes
            </h3>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              Terminal Node Cluster
            </span>
          </div>
        </div>

        <button
          onClick={() => openAtmSimulator({ showPortSelector: true })}
          className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 dark:text-bullion-400 hover:text-slate-900 dark:hover:text-bullion-300 transition"
        >
          <span>Launch Simulator</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Terminal Node Status Indicators */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 1, port: ":8081", status: "ONLINE", label: "Central Terminal" },
          { id: 2, port: ":8082", status: "ONLINE", label: "Sub-Branch Node" },
          { id: 3, port: ":8083", status: "ONLINE", label: "CDM Vault Feeder" },
        ].map((node) => (
          <div
            key={node.id}
            onClick={() => openAtmSimulator({ showPortSelector: true, initialAtmId: node.id })}
            className="group cursor-pointer rounded-xl border border-slate-200/80 dark:border-vault-border bg-slate-50/70 dark:bg-vault-surface/60 p-2.5 hover:border-slate-400 dark:hover:border-vault-highlight transition active:scale-98"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono font-bold text-slate-900 dark:text-white">
                #{node.id}
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-600 dark:text-ledger-credit">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {node.status}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {node.port}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Launch Action Ribbon */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => openAtmSimulator({ showPortSelector: true, initialAtmId: 1 })}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-xs font-mono font-bold transition active:scale-95"
        >
          <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Cash Deposit (CDM)</span>
        </button>

        <button
          onClick={() => openAtmSimulator({ showPortSelector: true, initialAtmId: 1 })}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-bullion-500/30 bg-bullion-500/10 hover:bg-bullion-500/20 text-bullion-800 dark:text-bullion-300 text-xs font-mono font-bold transition active:scale-95"
        >
          <ArrowUpCircle className="h-3.5 w-3.5 text-bullion-600 dark:text-bullion-400" />
          <span>Cardless Cash-Out</span>
        </button>
      </div>
    </div>
  );
}
