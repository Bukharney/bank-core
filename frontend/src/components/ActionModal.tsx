"use client";

import React, { useState } from "react";
import { Account, CardlessWithdrawalTicket } from "@/lib/types";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { thbToSatang, formatMoney, satangToThb } from "@/lib/currency";
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Phone,
  KeyRound,
  Clock,
  Cpu,
  Copy,
  Check,
} from "lucide-react";
import ATMSimulatorModal from "./ATMSimulatorModal";

interface ActionModalProps {
  type: "deposit" | "withdraw" | null;
  account: Account | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ActionModal({ type, account, onClose, onSuccess }: ActionModalProps) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [atmId, setAtmId] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Cardless Ticket State
  const [ticket, setTicket] = useState<CardlessWithdrawalTicket | null>(null);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);

  if (!type || !account) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const satang = thbToSatang(amount);
    if (satang <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    if (type === "withdraw" && satang > account.balance) {
      setError("Insufficient balance in account");
      return;
    }

    setLoading(true);
    try {
      if (type === "deposit") {
        const res = await api.transactions.deposit({
          account_id: account.id,
          amount: satang,
          currency: account.currency,
          deposit_ref: `DEP-${Date.now()}`,
          description: description || "Quick Deposit",
        });

        if (res.error) {
          setError(res.error);
          showToast(res.error, "error");
        } else {
          showToast(`Deposit of ฿${amount} successful!`, "success");
          onSuccess();
          onClose();
        }
      } else {
        // Request Cardless Withdrawal Ticket (Phone + 6-digit OTP)
        const res = await api.transactions.requestCardless({
          account_id: account.id,
          amount: satang,
          currency: account.currency,
          atm_id: atmId,
        });

        if (res.error) {
          setError(res.error);
          showToast(res.error, "error");
        } else if (res.data) {
          setTicket(res.data);
          showToast("6-Digit Cardless ATM PIN Generated!", "success");
        }
      }
    } catch (err: any) {
      setError(err.message || "Operation failed");
      showToast(err.message || "Operation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    showToast("ATM PIN copied to clipboard!", "info");
    setTimeout(() => setCopied(false), 2000);
  };

  const quickAmounts = [100, 500, 1000, 5000];

  // If simulator is active
  if (showSimulator && ticket) {
    return (
      <ATMSimulatorModal
        initialAtmId={ticket.atm_id}
        initialPhone={ticket.phone_number}
        initialCode={ticket.code}
        onClose={() => {
          setShowSimulator(false);
          onClose();
        }}
        onSuccess={() => {
          onSuccess();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md my-auto max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-6 sm:p-8 shadow-2xl animate-slide-up space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* TICKET VIEW (When Withdrawal Code is Generated) */}
        {ticket ? (
          <div className="space-y-6 text-center animate-fade-in">
            <div className="flex h-12 w-12 items-center justify-center mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
              <KeyRound className="h-6 w-6" />
            </div>

            <div>
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                CARDLESS WITHDRAWAL READY
              </span>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono mt-2">
                ฿{satangToThb(ticket.amount)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your Phone & Code at ATM #{ticket.atm_id}
              </p>
            </div>

            {/* OTP Ticket Details Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  Mobile Number
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {ticket.phone_number}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                  6-Digit ATM PIN
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-slate-900 dark:text-amber-400 text-lg tracking-wider">
                    {ticket.code}
                  </span>
                  <button
                    onClick={() => copyCode(ticket.code)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                    title="Copy Code"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Valid for:
                </span>
                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">15 Minutes</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setShowSimulator(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white py-3 text-sm font-semibold text-white dark:text-slate-900 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition"
              >
                <Cpu className="h-4 w-4" />
                <span>Launch ATM Simulator</span>
              </button>

              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="w-full rounded-xl py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                Done (I will visit physical ATM)
              </button>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                  type === "deposit"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {type === "deposit" ? (
                  <ArrowDownLeft className="h-5 w-5" />
                ) : (
                  <ArrowUpRight className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                  {type === "withdraw" ? "Cardless ATM Cash Out" : "Deposit Funds"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Account #{account.id} • Available: {formatMoney(account.balance, account.currency)}
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Amount ({account.currency})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg font-mono">
                    ฿
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-3 pl-9 pr-4 text-2xl font-bold font-mono text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
                  />
                </div>

                {/* Quick Amount Chips */}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {quickAmounts.map((q) => (
                    <button
                      type="button"
                      key={q}
                      onClick={() => setAmount(q.toString())}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      +{q.toLocaleString()} ฿
                    </button>
                  ))}
                  {type === "withdraw" && (
                    <button
                      type="button"
                      onClick={() => setAmount((account.balance / 100).toString())}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      Max Balance
                    </button>
                  )}
                </div>
              </div>

              {type === "withdraw" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Target ATM Terminal
                  </label>
                  <select
                    value={atmId}
                    onChange={(e) => setAtmId(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-slate-900 dark:focus:border-white focus:outline-none"
                  >
                    <option value={1}>ATM #01 - Bangkok Central Station (:8081)</option>
                    <option value={2}>ATM #02 - Silom Tech Park (:8082)</option>
                    <option value={3}>ATM #03 - Sukhumvit Gateway (:8083)</option>
                  </select>
                </div>
              )}

              {type === "deposit" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Salary deposit, Savings..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-white focus:outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] ${
                  type === "deposit"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
                } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{type === "deposit" ? "Confirm Deposit" : "Generate 6-Digit Code"}</span>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
