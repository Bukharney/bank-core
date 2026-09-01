"use client";

import React, { useState, useEffect } from "react";
import { formatMoney, satangToThb } from "@/lib/currency";
import { api } from "@/lib/api";
import {
  X,
  Phone,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  RotateCcw,
  Cpu,
} from "lucide-react";
import confetti from "canvas-confetti";

interface ATMSimulatorModalProps {
  initialPhone?: string;
  initialCode?: string;
  initialAtmId?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ATMSimulatorModal({
  initialPhone = "",
  initialCode = "",
  initialAtmId = 1,
  onClose,
  onSuccess,
}: ATMSimulatorModalProps) {
  const [atmId, setAtmId] = useState<number>(initialAtmId);
  const [step, setStep] = useState<"phone" | "code" | "confirm" | "dispensing" | "success" | "error">("phone");
  const [phone, setPhone] = useState<string>(initialPhone);
  const [code, setCode] = useState<string>(initialCode);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [claimData, setClaimData] = useState<{
    customer_name?: string;
    amount?: number;
    currency?: string;
  } | null>(null);

  useEffect(() => {
    if (initialPhone && initialCode) {
      setPhone(initialPhone);
      setCode(initialCode);
      setStep("code");
    }
  }, [initialPhone, initialCode]);

  const handleKeyPress = (num: string) => {
    if (step === "phone") {
      if (phone.length < 10) setPhone((prev) => prev + num);
    } else if (step === "code") {
      if (code.length < 6) setCode((prev) => prev + num);
    }
  };

  const handleClear = () => {
    if (step === "phone") setPhone("");
    if (step === "code") setCode("");
    setErrorMessage("");
  };

  const handleEnter = async () => {
    if (step === "phone") {
      if (phone.length < 9) {
        setErrorMessage("Please enter a valid 10-digit mobile number");
        return;
      }
      setErrorMessage("");
      setStep("code");
    } else if (step === "code") {
      if (code.length !== 6) {
        setErrorMessage("Please enter the 6-digit withdrawal code");
        return;
      }
      await verifyAndDispense();
    }
  };

  const verifyAndDispense = async () => {
    setLoading(true);
    setErrorMessage("");
    setStep("dispensing");

    try {
      const res = await api.transactions.claimAtATM(atmId, phone, code);
      setClaimData(res);
      setStep("success");

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#0f172a", "#10b981", "#3b82f6"],
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process withdrawal at ATM");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneDisplay = (p: string) => {
    if (!p) return "";
    if (p.length <= 3) return p;
    if (p.length <= 6) return `${p.slice(0, 3)}-${p.slice(3)}`;
    return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6, 10)}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* ATM Cabinet Bezel */}
      <div className="relative w-full max-w-md my-auto max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-5 sm:p-6 shadow-2xl overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
          title="Close ATM"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ATM Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3.5 pr-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-wider text-slate-900 dark:text-white">BANK CORE ATM</h2>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>ONLINE • READY</span>
              </div>
            </div>
          </div>

          {/* ATM Port Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {[1, 2, 3].map((id) => (
              <button
                key={id}
                onClick={() => setAtmId(id)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded transition ${
                  atmId === id
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                #{id}
              </button>
            ))}
          </div>
        </div>

        {/* Digital Screen */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-inner min-h-[160px] flex flex-col justify-between text-slate-100">
          {step === "phone" && (
            <div className="space-y-2 text-center my-auto">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-widest">
                <Phone className="h-3.5 w-3.5" />
                <span>STEP 1: ENTER MOBILE NUMBER</span>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 py-2 px-3 text-center font-mono text-xl sm:text-2xl font-bold tracking-widest text-emerald-300 min-h-[44px]">
                {formatPhoneDisplay(phone) || (
                  <span className="text-emerald-700 animate-pulse text-base sm:text-lg">08X-XXX-XXXX</span>
                )}
              </div>
              {errorMessage && (
                <p className="text-[11px] text-rose-400 font-mono leading-tight">{errorMessage}</p>
              )}
              <p className="text-[10px] text-slate-400 font-mono">
                Enter registered mobile number
              </p>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-2 text-center my-auto">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-widest">
                <KeyRound className="h-3.5 w-3.5" />
                <span>STEP 2: ENTER 6-DIGIT CODE</span>
              </div>
              <div className="flex justify-center gap-1.5 sm:gap-2 font-mono text-xl sm:text-2xl">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    className={`flex h-10 w-8 sm:h-11 sm:w-9 items-center justify-center rounded-xl border font-bold transition-all ${
                      code[idx]
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-800 bg-slate-900 text-slate-600"
                    }`}
                  >
                    {code[idx] || "•"}
                  </div>
                ))}
              </div>
              {errorMessage && (
                <p className="text-[11px] text-rose-400 font-mono leading-tight">{errorMessage}</p>
              )}
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono px-1">
                <span>Phone: {formatPhoneDisplay(phone)}</span>
                <button
                  onClick={() => setStep("phone")}
                  className="text-emerald-400 underline hover:text-emerald-300"
                >
                  Edit Phone
                </button>
              </div>
            </div>
          )}

          {step === "dispensing" && (
            <div className="space-y-2 text-center my-auto">
              <div className="h-8 w-8 animate-spin mx-auto rounded-full border-2 border-emerald-400 border-t-transparent" />
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white font-mono">DISPENSING CASH...</h3>
                <p className="text-[10px] text-emerald-400 font-mono">
                  Counting banknotes
                </p>
              </div>
            </div>
          )}

          {step === "success" && claimData && (
            <div className="space-y-1.5 text-center my-auto">
              <div className="flex h-8 w-8 items-center justify-center mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Cash Out Complete</span>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  ฿{satangToThb(claimData.amount || 0)}
                </div>
                <div className="text-xs font-semibold text-slate-300">
                  Customer: {claimData.customer_name}
                </div>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-1.5 text-center my-auto">
              <div className="flex h-8 w-8 items-center justify-center mx-auto rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-xs font-bold text-rose-300 font-mono">TRANSACTION REJECTED</h3>
              <p className="text-[11px] text-slate-300 max-w-xs mx-auto font-mono leading-tight">{errorMessage}</p>
              <button
                onClick={() => {
                  setStep("code");
                  setCode("");
                  setErrorMessage("");
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 font-mono underline pt-1"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* Bottom Status */}
          <div className="pt-1.5 border-t border-slate-900 flex items-center justify-between text-[9px] font-mono text-slate-500">
            <span>TERMINAL :808{atmId}</span>
            <span>CARDLESS OTP</span>
          </div>
        </div>

        {/* Cash Slot Dispenser */}
        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1 px-1">
            <span className="flex items-center gap-1">
              <Banknote className="h-3 w-3 text-slate-700 dark:text-slate-300" />
              <span>CASH DISPENSER</span>
            </span>
            <span className={step === "success" ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-400"}>
              {step === "success" ? "● CASH READY" : "● READY"}
            </span>
          </div>

          <div
            className={`relative flex h-8 w-full items-center justify-center rounded-lg border transition-all ${
              step === "success"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm"
                : "border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-800"
            }`}
          >
            {step === "success" ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 animate-bounce">
                <Banknote className="h-3.5 w-3.5" />
                <span>[ TAKE CASH HERE ]</span>
              </div>
            ) : (
              <div className="h-1 w-2/3 rounded-full bg-slate-400 dark:bg-slate-600" />
            )}
          </div>
        </div>

        {/* Tactile Keypad */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              disabled={step === "dispensing" || step === "success"}
              className="flex h-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-base font-bold text-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition disabled:opacity-50"
            >
              {num}
            </button>
          ))}

          {/* CLEAR */}
          <button
            onClick={handleClear}
            disabled={step === "dispensing" || step === "success"}
            className="flex h-10 items-center justify-center rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 font-mono text-xs font-bold text-amber-700 dark:text-amber-400 shadow-sm hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition disabled:opacity-50"
          >
            CLEAR
          </button>

          {/* 0 */}
          <button
            onClick={() => handleKeyPress("0")}
            disabled={step === "dispensing" || step === "success"}
            className="flex h-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-base font-bold text-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition disabled:opacity-50"
          >
            0
          </button>

          {/* ENTER */}
          <button
            onClick={step === "success" ? onClose : handleEnter}
            disabled={step === "dispensing"}
            className="flex h-10 items-center justify-center rounded-xl border border-slate-900 dark:border-white bg-slate-900 dark:bg-white font-mono text-xs font-bold text-white dark:text-slate-900 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition disabled:opacity-50"
          >
            {step === "success" ? "DONE" : "ENTER"}
          </button>
        </div>
      </div>
    </div>
  );
}
