"use client";

import React, { useState, useMemo } from "react";
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
  ShieldCheck,
  Lock,
} from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live Password Strength Calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: "Weak", color: "bg-rose-500" };
      case 2:
        return { score: 2, label: "Fair", color: "bg-amber-500" };
      case 3:
        return { score: 3, label: "Good", color: "bg-blue-500" };
      case 4:
        return { score: 4, label: "Strong", color: "bg-emerald-500" };
      default:
        return { score: 0, label: "Too Short", color: "bg-slate-300 dark:bg-vault-border" };
    }
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 9) {
      setError("Please enter a valid mobile phone number");
      return;
    }

    setLoading(true);

    try {
      const res = await register({
        username,
        email,
        phone_number: cleanPhone,
        password,
        first_name: firstName,
        last_name: lastName,
      });

      if (!res.success) {
        setError(res.error || "Registration failed. Please check your details.");
        showToast(res.error || "Registration failed", "error");
      } else {
        showToast("Account created successfully! Welcome to Bank Core.", "success");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to Bank Core service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 relative">
      {/* Background radial glow */}
      <div className="absolute w-96 h-96 rounded-full bg-bullion-500/5 blur-3xl pointer-events-none -top-10 -right-10" />
      <div className="absolute w-96 h-96 rounded-full bg-ledger-credit/5 blur-3xl pointer-events-none -bottom-10 -left-10" />

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
              Direct Vault Enrollment
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Open Vault Account
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              Initialize Sovereign Core Account & Double-Entry Ledger
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

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Somchai"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2 px-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-400 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Jaidee"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2 px-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-400 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Vault Username
              </label>
              <input
                type="text"
                required
                placeholder="somchai_bank"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2 px-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-400 focus:outline-none font-mono transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Mobile Phone (Cardless ATM Link)
              </label>
              <input
                type="tel"
                required
                placeholder="0812345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2 px-3 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-400 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2 px-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-400 focus:outline-none transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Master Password
                </label>
                {password && (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Strength: <span className={passwordStrength.score >= 3 ? "text-ledger-credit font-bold" : "text-amber-500 font-bold"}>{passwordStrength.label}</span>
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Min 8 chars, 1 number, 1 uppercase"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2 pl-3 pr-9 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-400 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-bullion-400 transition"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 rounded-full transition-all ${
                        passwordStrength.score >= level
                          ? passwordStrength.color
                          : "bg-slate-200 dark:bg-vault-surface"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-bullion-500 dark:hover:bg-bullion-400 dark:text-vault-obsidian py-3 text-xs font-mono font-bold uppercase tracking-wider text-white shadow-xs dark:shadow-bullion-glow hover:bg-slate-800 active:scale-[0.98] transition ${
                  loading ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating Vault Account...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Open Vault Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-vault-border text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-slate-900 dark:text-bullion-400 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
