"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  Landmark,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
  Lock,
} from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || "Invalid email or password");
        showToast(res.error || "Invalid credentials", "error");
      } else {
        showToast("Access granted. Welcome to Vault Core!", "success");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to Bank Core service");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail("alice@example.com");
    setPassword("password123");
    showToast("Demo credentials loaded", "info");
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 relative">
      {/* Subtle background glow */}
      <div className="absolute w-96 h-96 rounded-full bg-bullion-500/5 blur-3xl pointer-events-none -top-10 -left-10" />
      <div className="absolute w-96 h-96 rounded-full bg-ledger-credit/5 blur-3xl pointer-events-none -bottom-10 -right-10" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 dark:bg-vault-card border border-slate-200 dark:border-bullion-500/30 text-bullion-400 shadow-xs dark:shadow-bullion-glow">
            <Landmark className="h-7 w-7 text-bullion-400" />
            <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-ledger-credit border-2 border-white dark:border-vault-card" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-bullion-500/10 border border-bullion-500/20 text-[10px] font-mono uppercase tracking-widest text-bullion-700 dark:text-bullion-400 mb-2">
              <ShieldCheck className="h-3 w-3" />
              Vault Access Gateway
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Sign in to Bank Core
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              Precision Core Banking & Atomic Double-Entry Ledger
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-6 sm:p-8 shadow-xs dark:shadow-card-depth space-y-5 transition-colors duration-300">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-400 font-mono">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2.5 px-3.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-bullion-400/30 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2.5 pl-3.5 pr-10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-bullion-400/30 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-bullion-400 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-bullion-500 dark:hover:bg-bullion-400 dark:text-vault-obsidian py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xs dark:shadow-bullion-glow hover:bg-slate-800 active:scale-[0.98] transition font-mono ${
                loading ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authorizing Gateway...</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Authenticate & Open Vault</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="pt-4 border-t border-slate-100 dark:border-vault-border flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-vault-border bg-slate-50 dark:bg-vault-surface px-2.5 py-1.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-bullion-300 hover:bg-slate-100 dark:hover:bg-vault-elevated transition"
            >
              <Zap className="h-3 w-3 text-bullion-500" />
              <span>Load Alice (Demo)</span>
            </button>

            <Link
              href="/register"
              className="text-xs font-semibold text-slate-900 dark:text-bullion-400 hover:underline font-mono"
            >
              Open Vault Account →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
