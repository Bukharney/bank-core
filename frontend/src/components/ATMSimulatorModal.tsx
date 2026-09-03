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
  ArrowDownCircle,
  ArrowUpCircle,
  Printer,
  FileText,
  Zap,
  ArrowLeft,
  Plus,
} from "lucide-react";
import confetti from "canvas-confetti";

interface ATMSimulatorModalProps {
  initialPhone?: string;
  initialCode?: string;
  initialAtmId?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

type ATMMode = "menu" | "withdrawal" | "deposit";

export default function ATMSimulatorModal({
  initialPhone = "",
  initialCode = "",
  initialAtmId = 1,
  onClose,
  onSuccess,
}: ATMSimulatorModalProps) {
  const [atmId, setAtmId] = useState<number>(initialAtmId);
  const [mode, setMode] = useState<ATMMode>(
    initialCode ? "withdrawal" : "menu"
  );

  // Withdrawal Steps
  const [withdrawStep, setWithdrawStep] = useState<
    "phone" | "code" | "dispensing" | "success" | "error"
  >(initialCode ? "code" : "phone");
  const [withdrawPhone, setWithdrawPhone] = useState<string>(initialPhone);
  const [withdrawCode, setWithdrawCode] = useState<string>(initialCode);
  const [claimData, setClaimData] = useState<{
    customer_name?: string;
    amount?: number;
    currency?: string;
  } | null>(null);

  // Deposit Steps
  const [depositStep, setDepositStep] = useState<
    "phone" | "confirm" | "feeder" | "processing" | "receipt" | "error"
  >("phone");
  const [depositPhone, setDepositPhone] = useState<string>("");
  const [depositRecipient, setDepositRecipient] = useState<{
    account_id?: number;
    masked_name?: string;
    masked_account_number?: string;
    currency?: string;
    account_type?: string;
  } | null>(null);
  const [notesCount, setNotesCount] = useState<{ [key: string]: number }>({
    "1000": 0,
    "500": 0,
    "100": 0,
  });
  const [depositReceipt, setDepositReceipt] = useState<{
    journal_id?: string;
    reference_id?: string;
    atm_id?: number;
    masked_name?: string;
    masked_account_number?: string;
    amount?: number;
    currency?: string;
    created_at?: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (initialPhone && initialCode) {
      setMode("withdrawal");
      setWithdrawPhone(initialPhone);
      setWithdrawCode(initialCode);
      setWithdrawStep("code");
    }
  }, [initialPhone, initialCode]);

  // Calculate total deposit amount in Satang
  const totalDepositSatang =
    ((notesCount["1000"] || 0) * 1000 +
      (notesCount["500"] || 0) * 500 +
      (notesCount["100"] || 0) * 100) *
    100;

  const handleKeyPress = (num: string) => {
    if (mode === "withdrawal") {
      if (withdrawStep === "phone") {
        if (withdrawPhone.length < 10) setWithdrawPhone((prev) => prev + num);
      } else if (withdrawStep === "code") {
        if (withdrawCode.length < 6) setWithdrawCode((prev) => prev + num);
      }
    } else if (mode === "deposit") {
      if (depositStep === "phone") {
        if (depositPhone.length < 10) setDepositPhone((prev) => prev + num);
      }
    }
  };

  const handleClear = () => {
    if (mode === "withdrawal") {
      if (withdrawStep === "phone") setWithdrawPhone("");
      if (withdrawStep === "code") setWithdrawCode("");
    } else if (mode === "deposit") {
      if (depositStep === "phone") setDepositPhone("");
      if (depositStep === "feeder") {
        setNotesCount({ "1000": 0, "500": 0, "100": 0 });
      }
    }
    setErrorMessage("");
  };

  const handleAddNote = (denomination: "1000" | "500" | "100") => {
    const currentTotal = totalDepositSatang / 100;
    const addition = parseInt(denomination);
    if (currentTotal + addition > 100000) {
      setErrorMessage("Maximum deposit limit is ฿100,000 per transaction");
      return;
    }
    setErrorMessage("");
    setNotesCount((prev) => ({
      ...prev,
      [denomination]: (prev[denomination] || 0) + 1,
    }));
  };

  const handleEnter = async () => {
    if (mode === "withdrawal") {
      if (withdrawStep === "phone") {
        if (withdrawPhone.length < 9) {
          setErrorMessage("Please enter a valid 10-digit mobile number");
          return;
        }
        setErrorMessage("");
        setWithdrawStep("code");
      } else if (withdrawStep === "code") {
        if (withdrawCode.length !== 6) {
          setErrorMessage("Please enter the 6-digit withdrawal code");
          return;
        }
        await verifyAndDispense();
      }
    } else if (mode === "deposit") {
      if (depositStep === "phone") {
        if (depositPhone.length < 9) {
          setErrorMessage("Please enter a valid 10-digit mobile number");
          return;
        }
        await lookupDepositRecipient();
      } else if (depositStep === "confirm") {
        setErrorMessage("");
        setDepositStep("feeder");
      } else if (depositStep === "feeder") {
        if (totalDepositSatang <= 0) {
          setErrorMessage("Please feed at least one banknote (min ฿100)");
          return;
        }
        await executeDeposit();
      }
    }
  };

  // Withdrawal: Call ATM microservice
  const verifyAndDispense = async () => {
    setLoading(true);
    setErrorMessage("");
    setWithdrawStep("dispensing");

    try {
      const res = await api.transactions.claimAtATM(atmId, withdrawPhone, withdrawCode);
      setClaimData(res);
      setWithdrawStep("success");

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
      setWithdrawStep("error");
    } finally {
      setLoading(false);
    }
  };

  // Deposit: Lookup Recipient by Phone
  const lookupDepositRecipient = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await api.transactions.atmDepositLookup(atmId, depositPhone);
      if (res.status === "error" || !res.account_id) {
        throw new Error(res.message || "No active account linked to this phone number");
      }
      setDepositRecipient(res);
      setDepositStep("confirm");
    } catch (err: any) {
      setErrorMessage(err.message || "No account found for this phone number");
    } finally {
      setLoading(false);
    }
  };

  // Deposit: Execute Cash Deposit
  const executeDeposit = async () => {
    setLoading(true);
    setErrorMessage("");
    setDepositStep("processing");

    try {
      const res = await api.transactions.atmDepositCash(
        atmId,
        depositPhone,
        totalDepositSatang,
        notesCount
      );

      if (res.status === "error") {
        throw new Error(res.message || "Deposit transaction rejected");
      }

      setDepositReceipt(res);
      setDepositStep("receipt");

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10b981", "#6366f1", "#0f172a"],
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to complete cash deposit");
      setDepositStep("error");
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

  const resetToMenu = () => {
    setMode("menu");
    setWithdrawStep("phone");
    setWithdrawPhone("");
    setWithdrawCode("");
    setClaimData(null);
    setDepositStep("phone");
    setDepositPhone("");
    setDepositRecipient(null);
    setNotesCount({ "1000": 0, "500": 0, "100": 0 });
    setDepositReceipt(null);
    setErrorMessage("");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* ATM Cabinet Bezel */}
      <div className="relative w-full max-w-md my-auto max-h-[94vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-5 sm:p-6 shadow-2xl overflow-y-auto">
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
              <h2 className="text-xs font-bold tracking-wider text-slate-900 dark:text-white">BANK CORE ATM / CDM</h2>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE • CASH DEPOSIT READY</span>
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-inner min-h-[190px] flex flex-col justify-between text-slate-100">
          {/* Top Bar on LCD */}
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              {mode !== "menu" && (
                <button
                  onClick={resetToMenu}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-bold"
                >
                  <ArrowLeft className="h-2.5 w-2.5" />
                  <span>MENU</span>
                </button>
              )}
              <span>TERMINAL :808{atmId}</span>
            </div>
            <span className="text-emerald-400 font-bold uppercase">
              {mode === "menu"
                ? "MAIN MENU"
                : mode === "deposit"
                ? "PROMPTPAY CASH DEPOSIT"
                : "CARDLESS WITHDRAWAL"}
            </span>
          </div>

          {/* 1. MAIN MENU */}
          {mode === "menu" && (
            <div className="space-y-3 my-auto py-2">
              <div className="text-center">
                <div className="text-xs font-mono font-bold text-slate-200">
                  WELCOME TO CENTRAL CORE ATM
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Select transaction service below
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={() => {
                    setMode("deposit");
                    setDepositStep("phone");
                    setErrorMessage("");
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 hover:border-emerald-400 transition group text-center"
                >
                  <ArrowDownCircle className="h-5 w-5 mb-1.5 text-emerald-400 group-hover:scale-110 transition" />
                  <span className="font-mono text-xs font-bold">CASH DEPOSIT</span>
                  <span className="text-[9px] text-emerald-400/80 font-mono mt-0.5">
                    Deposit via Phone (CDM)
                  </span>
                </button>

                <button
                  onClick={() => {
                    setMode("withdrawal");
                    setWithdrawStep("phone");
                    setErrorMessage("");
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-indigo-500/40 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 hover:border-indigo-400 transition group text-center"
                >
                  <ArrowUpCircle className="h-5 w-5 mb-1.5 text-indigo-400 group-hover:scale-110 transition" />
                  <span className="font-mono text-xs font-bold">WITHDRAWAL</span>
                  <span className="text-[9px] text-indigo-400/80 font-mono mt-0.5">
                    Cardless 6-Digit OTP
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 2. CASH DEPOSIT FLOW */}
          {mode === "deposit" && (
            <>
              {depositStep === "phone" && (
                <div className="space-y-2 text-center my-auto py-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-widest">
                    <Phone className="h-3.5 w-3.5" />
                    <span>STEP 1: RECIPIENT PHONE NUMBER</span>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 py-2 px-3 text-center font-mono text-xl sm:text-2xl font-bold tracking-widest text-emerald-300 min-h-[44px]">
                    {formatPhoneDisplay(depositPhone) || (
                      <span className="text-emerald-700 animate-pulse text-base sm:text-lg">
                        08X-XXX-XXXX
                      </span>
                    )}
                  </div>
                  {errorMessage && (
                    <p className="text-[11px] text-rose-400 font-mono leading-tight">
                      {errorMessage}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 font-mono">
                    Enter linked mobile number to deposit cash
                  </p>
                </div>
              )}

              {depositStep === "confirm" && depositRecipient && (
                <div className="space-y-2 text-center my-auto py-1">
                  <div className="text-[11px] text-emerald-400 font-bold font-mono uppercase tracking-widest">
                    STEP 2: CONFIRM RECIPIENT
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-left space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Recipient Name:</span>
                      <span className="font-bold text-emerald-300">
                        {depositRecipient.masked_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account No:</span>
                      <span className="font-bold text-white">
                        {depositRecipient.masked_account_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Type:</span>
                      <span className="text-slate-300">
                        {depositRecipient.account_type} ({depositRecipient.currency})
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Press ENTER to open cash feeder slot
                  </p>
                </div>
              )}

              {depositStep === "feeder" && (
                <div className="space-y-2 text-center my-auto py-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-widest">
                    <Banknote className="h-3.5 w-3.5" />
                    <span>STEP 3: FEED CASH BANKNOTES</span>
                  </div>

                  {/* Banknote Quick Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddNote("100")}
                      className="rounded-lg border border-amber-500/40 bg-amber-950/30 hover:bg-amber-900/40 py-1 px-1.5 text-amber-300 font-mono text-[11px] font-bold transition active:scale-95"
                    >
                      +฿100
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNote("500")}
                      className="rounded-lg border border-purple-500/40 bg-purple-950/30 hover:bg-purple-900/40 py-1 px-1.5 text-purple-300 font-mono text-[11px] font-bold transition active:scale-95"
                    >
                      +฿500
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNote("1000")}
                      className="rounded-lg border border-slate-400/40 bg-slate-800/40 hover:bg-slate-700/40 py-1 px-1.5 text-slate-200 font-mono text-[11px] font-bold transition active:scale-95"
                    >
                      +฿1,000
                    </button>
                  </div>

                  {/* Total Ingested Amount */}
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 py-1.5 px-3">
                    <div className="text-[10px] uppercase font-mono text-slate-400">Total Inserted</div>
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                      ฿{(totalDepositSatang / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Notes Breakdown */}
                  <div className="flex justify-center items-center gap-3 text-[10px] font-mono text-slate-400">
                    <span>1K: {notesCount["1000"]}</span>
                    <span>500: {notesCount["500"]}</span>
                    <span>100: {notesCount["100"]}</span>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-rose-400 hover:underline"
                    >
                      Reset
                    </button>
                  </div>

                  {errorMessage && (
                    <p className="text-[10px] text-rose-400 font-mono leading-tight">
                      {errorMessage}
                    </p>
                  )}
                </div>
              )}

              {depositStep === "processing" && (
                <div className="space-y-2 text-center my-auto py-2">
                  <div className="h-8 w-8 animate-spin mx-auto rounded-full border-2 border-emerald-400 border-t-transparent" />
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold text-white font-mono">COUNTING & COMMITTING...</h3>
                    <p className="text-[10px] text-emerald-400 font-mono">
                      Recording double-entry ledger postings
                    </p>
                  </div>
                </div>
              )}

              {/* Thermal ATM Printed Receipt */}
              {depositStep === "receipt" && depositReceipt && (
                <div className="space-y-2 text-center my-auto py-1">
                  <div className="rounded-xl border border-slate-700 bg-white text-slate-900 p-3 shadow-md text-left font-mono text-[10px] space-y-1">
                    <div className="text-center font-bold text-xs pb-1 border-b border-dashed border-slate-300">
                      *** CORE BANK ATM RECEIPT ***
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">REF:</span>
                      <span className="font-bold">{depositReceipt.reference_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">TERMINAL:</span>
                      <span>ATM #{atmId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">RECIPIENT:</span>
                      <span className="font-bold">{depositReceipt.masked_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ACCOUNT:</span>
                      <span>{depositReceipt.masked_account_number}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-dashed border-slate-300 text-xs">
                      <span className="font-bold">DEPOSITED:</span>
                      <span className="font-bold text-emerald-700">
                        ฿{satangToThb(depositReceipt.amount || 0)}
                      </span>
                    </div>
                    <div className="text-center text-[9px] text-slate-400 pt-1">
                      STATUS: POSTED TO LEDGER
                    </div>
                  </div>
                </div>
              )}

              {depositStep === "error" && (
                <div className="space-y-1.5 text-center my-auto py-1">
                  <div className="flex h-8 w-8 items-center justify-center mx-auto rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h3 className="text-xs font-bold text-rose-300 font-mono">DEPOSIT REJECTED</h3>
                  <p className="text-[11px] text-slate-300 max-w-xs mx-auto font-mono leading-tight">
                    {errorMessage}
                  </p>
                  <button
                    onClick={() => {
                      setDepositStep("feeder");
                      setErrorMessage("");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 font-mono underline pt-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Try Again</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* 3. WITHDRAWAL FLOW */}
          {mode === "withdrawal" && (
            <>
              {withdrawStep === "phone" && (
                <div className="space-y-2 text-center my-auto py-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-widest">
                    <Phone className="h-3.5 w-3.5" />
                    <span>STEP 1: ENTER MOBILE NUMBER</span>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 py-2 px-3 text-center font-mono text-xl sm:text-2xl font-bold tracking-widest text-emerald-300 min-h-[44px]">
                    {formatPhoneDisplay(withdrawPhone) || (
                      <span className="text-emerald-700 animate-pulse text-base sm:text-lg">
                        08X-XXX-XXXX
                      </span>
                    )}
                  </div>
                  {errorMessage && (
                    <p className="text-[11px] text-rose-400 font-mono leading-tight">
                      {errorMessage}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 font-mono">
                    Enter registered mobile number
                  </p>
                </div>
              )}

              {withdrawStep === "code" && (
                <div className="space-y-2 text-center my-auto py-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-widest">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>STEP 2: ENTER 6-DIGIT CODE</span>
                  </div>
                  <div className="flex justify-center gap-1.5 sm:gap-2 font-mono text-xl sm:text-2xl">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        className={`flex h-10 w-8 sm:h-11 sm:w-9 items-center justify-center rounded-xl border font-bold transition-all ${
                          withdrawCode[idx]
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                            : "border-slate-800 bg-slate-900 text-slate-600"
                        }`}
                      >
                        {withdrawCode[idx] || "•"}
                      </div>
                    ))}
                  </div>
                  {errorMessage && (
                    <p className="text-[11px] text-rose-400 font-mono leading-tight">
                      {errorMessage}
                    </p>
                  )}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono px-1">
                    <span>Phone: {formatPhoneDisplay(withdrawPhone)}</span>
                    <button
                      onClick={() => setWithdrawStep("phone")}
                      className="text-emerald-400 underline hover:text-emerald-300"
                    >
                      Edit Phone
                    </button>
                  </div>
                </div>
              )}

              {withdrawStep === "dispensing" && (
                <div className="space-y-2 text-center my-auto py-1">
                  <div className="h-8 w-8 animate-spin mx-auto rounded-full border-2 border-emerald-400 border-t-transparent" />
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold text-white font-mono">DISPENSING CASH...</h3>
                    <p className="text-[10px] text-emerald-400 font-mono">
                      Counting banknotes from vault
                    </p>
                  </div>
                </div>
              )}

              {withdrawStep === "success" && claimData && (
                <div className="space-y-1.5 text-center my-auto py-1">
                  <div className="flex h-8 w-8 items-center justify-center mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Cash Out Complete
                    </span>
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                      ฿{satangToThb(claimData.amount || 0)}
                    </div>
                    <div className="text-xs font-semibold text-slate-300">
                      Customer: {claimData.customer_name}
                    </div>
                  </div>
                </div>
              )}

              {withdrawStep === "error" && (
                <div className="space-y-1.5 text-center my-auto py-1">
                  <div className="flex h-8 w-8 items-center justify-center mx-auto rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h3 className="text-xs font-bold text-rose-300 font-mono">TRANSACTION REJECTED</h3>
                  <p className="text-[11px] text-slate-300 max-w-xs mx-auto font-mono leading-tight">
                    {errorMessage}
                  </p>
                  <button
                    onClick={() => {
                      setWithdrawStep("code");
                      setWithdrawCode("");
                      setErrorMessage("");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 font-mono underline pt-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Try Again</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Cash Slot (Dispenser / Feeder) */}
        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1 px-1">
            <span className="flex items-center gap-1">
              <Banknote className="h-3 w-3 text-slate-700 dark:text-slate-300" />
              <span>
                {mode === "deposit"
                  ? "CASH FEEDER (CDM SLOT)"
                  : "CASH DISPENSER"}
              </span>
            </span>
            <span
              className={
                withdrawStep === "success" || depositStep === "receipt"
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : depositStep === "feeder"
                  ? "text-amber-500 font-bold animate-pulse"
                  : "text-slate-400"
              }
            >
              {withdrawStep === "success"
                ? "● CASH READY"
                : depositStep === "feeder"
                ? "● INSERT NOTES"
                : depositStep === "receipt"
                ? "● CASH ACCEPTED"
                : "● READY"}
            </span>
          </div>

          <div
            className={`relative flex h-8 w-full items-center justify-center rounded-lg border transition-all ${
              withdrawStep === "success"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm"
                : depositStep === "feeder"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 animate-pulse"
                : "border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-800"
            }`}
          >
            {withdrawStep === "success" ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 animate-bounce">
                <Banknote className="h-3.5 w-3.5" />
                <span>[ TAKE CASH HERE ]</span>
              </div>
            ) : depositStep === "feeder" ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Banknote className="h-3.5 w-3.5" />
                <span>[ FEED BANKNOTES ]</span>
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
              disabled={
                loading ||
                mode === "menu" ||
                withdrawStep === "dispensing" ||
                withdrawStep === "success" ||
                depositStep === "processing" ||
                depositStep === "receipt"
              }
              className="flex h-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-base font-bold text-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition disabled:opacity-50"
            >
              {num}
            </button>
          ))}

          {/* CLEAR / CANCEL */}
          <button
            onClick={handleClear}
            disabled={
              loading ||
              mode === "menu" ||
              withdrawStep === "dispensing" ||
              depositStep === "processing"
            }
            className="flex h-10 items-center justify-center rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 font-mono text-xs font-bold text-amber-700 dark:text-amber-400 shadow-sm hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition disabled:opacity-50"
          >
            CLEAR
          </button>

          {/* 0 */}
          <button
            onClick={() => handleKeyPress("0")}
            disabled={
              loading ||
              mode === "menu" ||
              withdrawStep === "dispensing" ||
              withdrawStep === "success" ||
              depositStep === "processing" ||
              depositStep === "receipt"
            }
            className="flex h-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-base font-bold text-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition disabled:opacity-50"
          >
            0
          </button>

          {/* ENTER / ACTION */}
          <button
            onClick={() => {
              if (withdrawStep === "success" || depositStep === "receipt") {
                resetToMenu();
              } else if (mode === "menu") {
                setMode("deposit");
              } else {
                handleEnter();
              }
            }}
            disabled={loading || withdrawStep === "dispensing" || depositStep === "processing"}
            className="flex h-10 items-center justify-center rounded-xl border border-slate-900 dark:border-white bg-slate-900 dark:bg-white font-mono text-xs font-bold text-white dark:text-slate-900 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition disabled:opacity-50"
          >
            {withdrawStep === "success" || depositStep === "receipt"
              ? "FINISH"
              : depositStep === "feeder"
              ? "DEPOSIT"
              : "ENTER"}
          </button>
        </div>
      </div>
    </div>
  );
}
