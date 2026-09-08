"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, generateUUID } from "@/lib/api";
import { formatAccountNumber, formatAccountInput, formatMoney, thbToSatang } from "@/lib/currency";
import { Account, AccountPreview, TransferReceipt } from "@/lib/types";
import { getAccountMeta, COLOR_PRESETS } from "@/lib/accountMeta";
import ReceiptModal from "@/components/ReceiptModal";
import TransferConfirmModal from "@/components/TransferConfirmModal";
import KeypadPinModal from "@/components/KeypadPinModal";
import Link from "next/link";
import {
  ArrowLeftRight,
  Send,
  Loader2,
  Key,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  User,
  ShieldCheck,
  ShieldAlert,
  Lock,
  ArrowRight,
  X,
} from "lucide-react";

export default function TransferPage() {
  const { user, accounts, activeAccount, refreshData } = useAuth();
  const { showToast } = useToast();

  // Source Account Selection (Defaults to activeAccount or first account, local to this page)
  const [selectedSourceAccount, setSelectedSourceAccount] = useState<Account | null>(() => activeAccount || accounts[0] || null);

  // Auto-select on initial load once accounts become available
  useEffect(() => {
    if (!selectedSourceAccount && accounts.length > 0) {
      setSelectedSourceAccount(activeAccount || accounts[0]);
    } else if (selectedSourceAccount) {
      const fresh = accounts.find((a) => a.id === selectedSourceAccount.id);
      if (fresh && (fresh.balance !== selectedSourceAccount.balance || fresh.version !== selectedSourceAccount.version)) {
        setSelectedSourceAccount(fresh);
      }
    }
  }, [accounts, activeAccount, selectedSourceAccount]);

  const [receiverInput, setReceiverInput] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);

  // PIN Verification State
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinLoading, setPinLoading] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Real-time Recipient Verification State (Triggers ONLY upon full 10 digits)
  const [recipientAccount, setRecipientAccount] = useState<AccountPreview | null>(null);
  const [verifyingRecipient, setVerifyingRecipient] = useState<boolean>(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  // Transfer Confirmation Dialog State
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [receiptSenderAccount, setReceiptSenderAccount] = useState<Account | null>(null);
  const [receiptReceiverAccount, setReceiptReceiverAccount] = useState<Account | AccountPreview | null>(null);

  useEffect(() => {
    setIdempotencyKey(generateUUID());
  }, []);

  const rawDigits = receiverInput.replace(/\D/g, "");
  const otherOwnAccounts = accounts.filter((a) => a.id !== selectedSourceAccount?.id);

  // Validation Computations
  const satangAmount = thbToSatang(amount);
  const isOverBalance = Boolean(selectedSourceAccount && satangAmount > selectedSourceAccount.balance);
  const shortageSatang = selectedSourceAccount ? satangAmount - selectedSourceAccount.balance : 0;

  // Debounced Recipient Lookup strictly requiring 10 digits
  useEffect(() => {
    const cleanDigits = receiverInput.replace(/\D/g, "");
    if (!cleanDigits) {
      setRecipientAccount(null);
      setRecipientError(null);
      setVerifyingRecipient(false);
      return;
    }

    // Must be exactly 10 digits
    if (cleanDigits.length < 10) {
      setRecipientAccount(null);
      setRecipientError(null);
      setVerifyingRecipient(false);
      return;
    }

    if (
      selectedSourceAccount &&
      cleanDigits === selectedSourceAccount.account_number.replace(/\D/g, "")
    ) {
      setRecipientAccount(null);
      setRecipientError("Cannot transfer to the same source account");
      setVerifyingRecipient(false);
      return;
    }

    setVerifyingRecipient(true);
    setRecipientError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await api.accounts.getPreview(cleanDigits);
        if (res.data && res.data.id) {
          if (res.data.status !== "ACTIVE") {
            setRecipientAccount(null);
            setRecipientError(`Account #${res.data.id} is currently ${res.data.status}`);
          } else {
            setRecipientAccount(res.data);
            setRecipientError(null);
          }
        } else {
          setRecipientAccount(null);
          setRecipientError(res.error || `Account number "${receiverInput}" not found`);
        }
      } catch (err: any) {
        setRecipientAccount(null);
        setRecipientError(err?.message || `Account number "${receiverInput}" not found`);
      } finally {
        setVerifyingRecipient(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [receiverInput, selectedSourceAccount]);

  const resetForm = () => {
    setReceiverInput("");
    setAmount("");
    setDescription("");
    setIdempotencyKey(generateUUID());
    setError(null);
    setRecipientAccount(null);
    setRecipientError(null);
    setShowConfirmModal(false);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSourceAccount) {
      setError("Please select a source account to transfer from");
      return;
    }

    if (rawDigits.length !== 10) {
      setError("Please enter the full 10-digit account number");
      return;
    }

    if (!recipientAccount) {
      setError("Please ensure destination account is verified before proceeding");
      return;
    }

    if (recipientAccount.id === selectedSourceAccount.id) {
      setError("Cannot transfer money to the same account");
      return;
    }

    if (satangAmount <= 0) {
      setError("Please enter an amount greater than 0");
      return;
    }

    if (isOverBalance) {
      setError(`Insufficient balance. Shortage of ${formatMoney(shortageSatang, selectedSourceAccount.currency)}`);
      return;
    }

    // Open Confirmation Dialog
    setShowConfirmModal(true);
  };

  const handleProceedToPin = () => {
    setShowConfirmModal(false);
    setPinError(null);
    setShowPinModal(true);
  };

  const handleExecuteTransferWithPin = async (enteredPin: string) => {
    if (!selectedSourceAccount || !recipientAccount) return;

    setPinLoading(true);
    setPinError(null);

    // Generate fresh idempotency key per PIN submission attempt
    const freshIdempotencyKey = generateUUID();
    setIdempotencyKey(freshIdempotencyKey);

    try {
      const res = await api.transactions.transfer(
        {
          sender_account_id: selectedSourceAccount.id,
          receiver_account_id: recipientAccount.id,
          amount: satangAmount,
          currency: selectedSourceAccount.currency,
          description: description || "Peer-to-Peer Transfer",
          pin: enteredPin,
        },
        freshIdempotencyKey
      );

      if (res.error) {
        setPinError(res.error);
        showToast(res.error, "error");
      } else if (res.data) {
        setShowPinModal(false);
        setReceiptSenderAccount(selectedSourceAccount);
        setReceiptReceiverAccount(recipientAccount);
        setReceipt(res.data);
        showToast("Transfer authorized & executed successfully!", "success");
        await refreshData();
        resetForm();
      }
    } catch (err: any) {
      setPinError(err.message || "Transfer authorization failed");
      showToast(err.message || "Transfer failed", "error");
    } finally {
      setPinLoading(false);
    }
  };

  const quickAmounts = [100, 500, 1000, 2000, 5000];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Unconfigured PIN Security Warning Banner */}
      {user && user.has_pin === false && (
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
                You must configure a 6-digit transaction PIN in Settings before transferring funds.
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
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2DDD0] dark:border-vault-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian shadow-sm">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Money Transfer Hub
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              Instant, secure transfers to any Bank Core account or PromptPay
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-emerald-700 dark:text-ledger-credit text-xs font-mono font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            FREE INSTANT TRANSFER • ฿0.00 FEE
          </span>
        </div>
      </div>

      {/* Dual-Pane Institutional Settlement Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT PANE: Transfer Composer Form (7 Columns) */}
        <div className="lg:col-span-7 rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-6 sm:p-8 shadow-xs dark:shadow-milled space-y-6 transition-colors duration-300">
          {/* Rich Error Alert Banner */}
          {error && (
            <div className="flex items-center justify-between rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-300 shadow-sm animate-slide-up">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-200 shrink-0 font-bold">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <span className="font-medium">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="p-1 rounded-lg text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleReviewSubmit} className="space-y-6">
            {/* 1. Source Account Selector */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  1. From Account
                </label>
                {!selectedSourceAccount && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                    * Please select an account
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {accounts.map((acc) => {
                  const isSelected = selectedSourceAccount?.id === acc.id;
                  const meta = getAccountMeta(acc.id);
                  const colorPreset = COLOR_PRESETS[meta.color] || COLOR_PRESETS.bullion;

                  return (
                    <button
                      type="button"
                      key={acc.id}
                      onClick={() => {
                        setSelectedSourceAccount(acc);
                        setError(null);
                      }}
                      className={`relative overflow-hidden flex flex-col p-4 rounded-xl border text-left transition-all duration-300 ${
                        isSelected
                          ? `bg-white dark:bg-vault-surface border-2 ${colorPreset.activeBorderLight} dark:${colorPreset.activeBorderDark} ${colorPreset.activeRing} text-slate-900 dark:text-white shadow-md`
                          : "bg-white dark:bg-vault-surface/60 border border-slate-200/90 dark:border-vault-border hover:border-slate-300 dark:hover:border-vault-highlight text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-4 h-3 rounded-[2px] bg-gradient-to-br ${colorPreset.chip} border shrink-0`} />
                          <span className="text-xs font-bold truncate text-slate-900 dark:text-white">
                            {meta.nickname || `${acc.account_type} #${acc.id}`}
                          </span>
                        </div>
                        {isSelected && (
                          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${colorPreset.badge}`}>
                            SELECTED
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                        #{acc.id} • {formatAccountNumber(acc.account_number)}
                      </span>
                      <span className="text-sm font-bold font-mono tracking-tight tabular-nums mt-1.5 text-slate-900 dark:text-white">
                        {formatMoney(acc.balance, acc.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Destination Account Input & Quick Selector */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    2. Recipient Account Number (10 Digits)
                  </label>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    rawDigits.length === 10
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-ledger-credit border border-emerald-500/20"
                      : "bg-slate-100 dark:bg-vault-surface text-slate-500 dark:text-slate-400"
                  }`}>
                    {rawDigits.length}/10 digits
                  </span>
                </div>

                {/* Quick Select from Own Accounts */}
                {otherOwnAccounts.length > 0 && (
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          setReceiverInput(formatAccountInput(e.target.value));
                        }
                      }}
                      value=""
                      className="rounded-lg border border-slate-200 dark:border-vault-border bg-slate-50 dark:bg-vault-surface px-2.5 py-1 text-[10px] font-mono text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                    >
                      <option value="">⚡ My Other Accounts</option>
                      {otherOwnAccounts.map((own) => {
                        const ownMeta = getAccountMeta(own.id);
                        return (
                          <option key={own.id} value={own.account_number}>
                            {ownMeta.nickname || `${own.account_type} #${own.id}`} ({formatAccountNumber(own.account_number)})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={14}
                  placeholder="XXX-X-XXXXX-X (e.g. 236-6-83905-9)"
                  value={receiverInput}
                  onChange={(e) => setReceiverInput(formatAccountInput(e.target.value))}
                  className={`w-full rounded-xl border bg-white dark:bg-vault-surface py-3 px-3.5 text-sm font-mono tracking-wider text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none transition ${
                    recipientAccount
                      ? "border-emerald-500 focus:border-emerald-500"
                      : recipientError
                      ? "border-rose-500 focus:border-rose-500"
                      : "border-slate-200 dark:border-vault-border focus:border-slate-900 dark:focus:border-bullion-500"
                  }`}
                />
                {verifyingRecipient && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-bullion-500" />
                    <span className="text-[11px]">Validating...</span>
                  </div>
                )}
              </div>

              {/* Verified Recipient Box */}
              {recipientAccount && (
                <div className="mt-2.5 rounded-xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-vault-surface p-4 text-xs text-emerald-900 dark:text-emerald-300 animate-slide-up space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-ledger-credit font-bold text-xs">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {recipientAccount.account_holder_name || "Verified Customer"}
                        </div>
                        <div className="text-[10px] text-emerald-700 dark:text-ledger-credit font-mono">
                          Direct Core Settlement Ready
                        </div>
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-ledger-credit border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-ledger-credit" />
                      <span>VERIFIED ACTIVE</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Account Number:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatAccountNumber(recipientAccount.account_number)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Settlement Routing:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{recipientAccount.currency} • {recipientAccount.account_type}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Indicator */}
              {recipientError && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 animate-slide-up font-mono">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{recipientError}</span>
                </div>
              )}
            </div>

            {/* 3. Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  3. Transfer Amount (THB)
                </label>
                {selectedSourceAccount && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Available:{" "}
                    <span className="text-slate-900 dark:text-white font-bold">
                      {formatMoney(selectedSourceAccount.balance, selectedSourceAccount.currency)}
                    </span>
                  </span>
                )}
              </div>

              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xl font-mono transition-colors ${
                  isOverBalance ? "text-rose-500" : "text-slate-400 dark:text-slate-500"
                }`}>
                  ฿
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  className={`w-full rounded-xl border py-3.5 pl-10 pr-4 text-3xl font-extrabold font-mono tabular-nums transition-all focus:outline-none ${
                    isOverBalance
                      ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-600 dark:text-ledger-debit"
                      : "border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-500"
                  }`}
                />
              </div>

              {/* Inline Real-time Shortage Warning */}
              {isOverBalance && selectedSourceAccount && (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/40 p-2.5 text-xs text-rose-700 dark:text-rose-300 animate-slide-up font-mono">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>
                      Exceeds balance ({formatMoney(selectedSourceAccount.balance, selectedSourceAccount.currency)}) by{" "}
                      <strong>{formatMoney(shortageSatang, selectedSourceAccount.currency)}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAmount((selectedSourceAccount.balance / 100).toString())}
                    className="rounded-lg bg-rose-200/80 dark:bg-rose-900/80 hover:bg-rose-300 dark:hover:bg-rose-800 px-2 py-0.5 text-[10px] font-bold text-rose-900 dark:text-rose-100 transition shrink-0 ml-2"
                  >
                    Set Max
                  </button>
                </div>
              )}

              {/* Quick Amount Chips */}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {quickAmounts.map((q) => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => setAmount(q.toString())}
                    className="rounded-lg border border-slate-200 dark:border-vault-border bg-slate-50 dark:bg-vault-surface px-3 py-1.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-vault-highlight transition"
                  >
                    +{q.toLocaleString()} ฿
                  </button>
                ))}
                {selectedSourceAccount && (
                  <button
                    type="button"
                    onClick={() => setAmount((selectedSourceAccount.balance / 100).toString())}
                    className="rounded-lg border border-bullion-500/30 bg-bullion-500/10 px-3 py-1.5 text-xs font-mono font-bold text-bullion-700 dark:text-bullion-400 hover:bg-bullion-500/20 transition"
                  >
                    MAX
                  </button>
                )}
              </div>
            </div>

            {/* 4. Description Note */}
            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                4. Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Dinner, Rent, Invoice payment..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-500 focus:outline-none"
              />
            </div>

            {/* Review & Send Button */}
            <button
              type="submit"
              disabled={!selectedSourceAccount || verifyingRecipient || !recipientAccount || isOverBalance || satangAmount <= 0}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all ${
                isOverBalance
                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 cursor-not-allowed"
                  : !selectedSourceAccount || verifyingRecipient || !recipientAccount || satangAmount <= 0
                  ? "bg-slate-900 dark:bg-vault-surface text-white dark:text-slate-500 opacity-50 cursor-not-allowed border dark:border-vault-border"
                  : "bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian shadow-sm hover:bg-slate-800 dark:hover:bg-bullion-400 active:scale-[0.98] dark:shadow-bullion-glow"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {isOverBalance
                  ? "Insufficient Balance"
                  : "Review & Send Money"}
              </span>
            </button>
          </form>
        </div>

        {/* RIGHT PANE: Transfer Summary & Verification (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Transfer Summary Card */}
          <div className="relative overflow-hidden rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-6 shadow-xs dark:shadow-milled space-y-4">
            <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full border border-bullion-500/10 bg-rosette-seal pointer-events-none" />

            <div className="flex items-center justify-between border-b border-[#E2DDD0] dark:border-vault-border pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-bullion-500" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Transfer Summary
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-ledger-credit font-bold">
                ● Instant & Free
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Origin Section */}
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-vault-border/50">
                <span className="text-slate-500 dark:text-slate-400">From Account:</span>
                <span className="font-bold text-slate-900 dark:text-white text-right font-mono">
                  {selectedSourceAccount ? `${selectedSourceAccount.account_type} #${selectedSourceAccount.id}` : "Select account"}
                </span>
              </div>

              {/* Recipient Section */}
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-vault-border/50">
                <span className="text-slate-500 dark:text-slate-400">To Recipient:</span>
                <span className="font-bold text-slate-900 dark:text-white text-right">
                  {recipientAccount ? recipientAccount.account_holder_name : "Enter 10-digit account"}
                </span>
              </div>

              {/* Transfer Amount */}
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-vault-border/50">
                <span className="text-slate-500 dark:text-slate-400">Transfer Amount:</span>
                <span className="font-bold text-base text-slate-900 dark:text-white tabular-nums text-right font-mono">
                  {formatMoney(satangAmount || 0)}
                </span>
              </div>

              {/* Transfer Fee */}
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-vault-border/50">
                <span className="text-slate-500 dark:text-slate-400">Transfer Fee:</span>
                <span className="font-bold text-emerald-600 dark:text-ledger-credit text-right font-mono">
                  ฿0.00 (Free)
                </span>
              </div>

              {/* Estimated Post-Transfer Balance */}
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-vault-border/50">
                <span className="text-slate-500 dark:text-slate-400">Remaining Balance:</span>
                <span className={`font-bold tabular-nums text-right font-mono ${
                  isOverBalance ? "text-rose-500" : "text-slate-900 dark:text-white"
                }`}>
                  {selectedSourceAccount
                    ? formatMoney(
                        Math.max(0, selectedSourceAccount.balance - satangAmount),
                        selectedSourceAccount.currency
                      )
                    : "—"}
                </span>
              </div>

              {/* Delivery Speed Card */}
              <div className="rounded-xl border border-slate-200/80 dark:border-vault-border bg-slate-50/70 dark:bg-vault-surface/60 p-3 space-y-1.5 text-[11px]">
                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400">
                  Processing Details
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Transfer Speed</span>
                  <span className="font-bold text-emerald-600 dark:text-ledger-credit">Instant (Real-Time)</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Authorization</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">6-Digit PIN Required</span>
                </div>
              </div>
            </div>

            {/* Security Guarantee Banner */}
            <div className="rounded-xl border border-bullion-500/30 bg-bullion-500/5 p-3 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-bullion-800 dark:text-bullion-300">
                <ShieldCheck className="h-4 w-4 text-bullion-500" />
                <span>Bank-Grade Security Guarantee</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                Protected with 256-bit encryption and secured with your personal transaction PIN.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Review & Confirmation Modal */}
      <TransferConfirmModal
        isOpen={showConfirmModal}
        senderAccount={selectedSourceAccount}
        receiverAccount={recipientAccount}
        amountSatang={satangAmount}
        description={description}
        loading={loading}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleProceedToPin}
      />

      {/* 6-Digit Transaction PIN Entry Keypad Modal */}
      <KeypadPinModal
        isOpen={showPinModal}
        loading={pinLoading}
        error={pinError}
        onClearError={() => setPinError(null)}
        title="Authorize Transfer with PIN"
        subtitle={`Transferring ${formatMoney(satangAmount, selectedSourceAccount?.currency || "THB")} to ${recipientAccount?.account_holder_name || `Account #${recipientAccount?.id}`}`}
        onClose={() => {
          setShowPinModal(false);
          setPinError(null);
        }}
        onSubmit={handleExecuteTransferWithPin}
      />

      {/* Official Receipt Slip Modal */}
      <ReceiptModal
        receipt={receipt}
        senderAccount={receiptSenderAccount}
        receiverAccount={receiptReceiverAccount}
        onClose={() => {
          setReceipt(null);
          setReceiptSenderAccount(null);
          setReceiptReceiverAccount(null);
        }}
      />
    </div>
  );
}
