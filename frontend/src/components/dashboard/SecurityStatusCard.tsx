"use client";

import React from "react";
import Link from "next/link";
import { User } from "@/lib/types";
import { ShieldAlert, ShieldCheck, ArrowRight } from "lucide-react";

interface SecurityStatusCardProps {
  user: User | null;
}

export default function SecurityStatusCard({ user }: SecurityStatusCardProps) {
  if (!user) return null;

  if (user.has_pin === false) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/40 p-4 sm:p-5 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 font-bold">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">
              Transaction PIN Required
            </div>
            <div className="text-slate-600 dark:text-slate-300 mt-0.5">
              You must configure a 6-digit transaction PIN in Settings before transferring funds or requesting ATM cardless withdrawals.
            </div>
          </div>
        </div>

        <Link
          href="/settings"
          className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 text-xs transition shadow-sm shrink-0 active:scale-95"
        >
          <span>Set up PIN</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return null;
}
