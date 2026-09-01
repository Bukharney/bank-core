"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  BookOpenText,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    {
      href: "/",
      label: "Dashboard",
      subtitle: "Overview & Accounts",
      icon: LayoutDashboard,
    },
    {
      href: "/transfer",
      label: "Transfer Hub",
      subtitle: "Atomic P2P Payments",
      icon: ArrowLeftRight,
    },
    {
      href: "/ledger",
      label: "Ledger Explorer",
      subtitle: "Double-Entry Audit",
      icon: BookOpenText,
    },
  ];

  return (
    <aside className="w-full md:w-64 md:min-h-[calc(100vh-4rem)] border-r border-slate-200 bg-white/70 p-4 shrink-0 flex flex-col justify-between">
      <div className="space-y-6">
        {/* Navigation */}
        <div className="space-y-1">
          <div className="px-3 py-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Menu
          </div>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                  isActive
                    ? "bg-slate-900 text-white font-semibold shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-900"}`} />
                <div>
                  <div className="text-xs">{link.label}</div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Security Info Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Double-Entry Core</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Strict append-only financial journal with idempotency safety.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between px-2 text-[10px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Core :8080</span>
        </span>
        <span>Online</span>
      </div>
    </aside>
  );
}
