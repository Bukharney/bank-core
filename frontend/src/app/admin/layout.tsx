"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, ArrowLeft, Lock, Loader2 } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
            Verifying Cryptographic Credentials...
          </span>
        </div>
      </div>
    );
  }

  // If not logged in, AuthContext handles redirection, but keep safe fallback
  if (!user) {
    return null;
  }

  const role = user.role || "user";
  const isElevated = role === "admin" || role === "auditor";

  // If standard user or teller attempts to view /admin/*
  if (!isElevated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="w-full max-w-lg p-8 rounded-2xl bg-card border border-border shadow-2xl text-center flex flex-col items-center relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 text-rose-400 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/25 mb-4">
            <Lock className="w-3.5 h-3.5" /> 403 Forbidden
          </span>

          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Restricted Core Facility
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Access to the Operations Console, General Ledger, and ATM Fleet is strictly restricted to{" "}
            <span className="text-foreground font-semibold">Administrator</span> and{" "}
            <span className="text-foreground font-semibold">Auditor</span> clearance levels.
            Your current assigned role is{" "}
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-primary font-semibold">
              {role.toUpperCase()}
            </span>.
          </p>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Customer Portal
          </Link>
        </div>
      </div>
    );
  }

  // Auditor is restricted from User Management (/admin/users)
  if (role === "auditor" && pathname.startsWith("/admin/users")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <div className="w-full max-w-lg p-8 rounded-2xl bg-card border border-border text-center flex flex-col items-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            Role Permission Required
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            User identity administration and role modification requires{" "}
            <span className="text-foreground font-semibold">Administrator</span> privileges. Auditors maintain read-only inspection access over Financial Ledgers and System Telemetry.
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Operations
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
