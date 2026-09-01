"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, generateUUID } from "@/lib/api";
import { formatAccountNumber, formatAccountInput, formatMoney, thbToSatang } from "@/lib/currency";
import { Account, TransferReceipt } from "@/lib/types";
import { getAccountMeta, COLOR_PRESETS } from "@/lib/accountMeta";
import ReceiptModal from "@/components/ReceiptModal";
import TransferConfirmModal from "@/components/TransferConfirmModal";
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
  X,
} from "lucide-react";

export default function TransferPage() {
  const { user, accounts, refreshData } = useAuth();
  const { showToast } = useToast();

  // Explicit Source Account Selection (Starts as null, no auto-select)
  const [selectedSourceAccount, setSelectedSourceAccount] = useState<Account | null>(null);

  const [receiverInput, setReceiverInput] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);

  // Real-time Recipient Verification State (Triggers ONLY upon full 10 digits)
  const [recipientAccount, setRecipientAccount] = useState<Account | null>(null);
  const [verifyingRecipient, setVerifyingRecipient] = useState<boolean>(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  // Transfer Confirmation Dialog State
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [receiptSenderAccount, setReceiptSenderAccount] = useState<Account | null>(null);
  const [receiptReceiverAccount, setReceiptReceiverAccount] = useState<Account | null>(null);

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
        const res = await api.accounts.getById(cleanDigits);
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
          setRecipientError(`Account number "${receiverInput}" not found`);
        }
      } catch (err: any) {
        setRecipientAccount(null);
        setRecipientError(`Account number "${receiverInput}" not found`);
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

  const handleExecuteTransfer = async () => {
    if (!selectedSourceAccount || !recipientAccount) return;

    setLoading(true);

    try {
      const res = await api.transactions.transfer(
        {
          sender_account_id: selectedSourceAccount.id,
          receiver_account_id: recipientAccount.id,
          amount: satangAmount,
          currency: selectedSourceAccount.currency,
          description: description || "Peer-to-Peer Transfer",
        },
        idempotencyKey
      );

      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        setShowConfirmModal(false);
      } else if (res.data) {
        setShowConfirmModal(false);
        setReceiptSenderAccount(selectedSourceAccount);
        setReceiptReceiverAccount(recipientAccount);
        setReceipt(res.data);
        showToast("Transfer executed successfully!", "success");
        await refreshData();
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || "Transfer failed");
      showToast(err.message || "Transfer failed", "error");
      setShowConfirmModal(false);
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [100, 500, 1000, 2000, 5000];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
          <ArrowLeftRight className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Money Transfer Hub
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Instant atomic transfer settled with Double-Entry Ledger and Confirmation Safeguards.
        </p>
      </div>

      {/* Main Transfer Form Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/90 p-6 sm:p-8 shadow-sm space-y-6 transition-colors duration-200">
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

        <form onSubmit={handleReviewSubmit} className="space-y-5">
          {/* 1. Source Account Selector (Explicit Selection) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                1. Select Source Account
              </label>
              {!selectedSourceAccount && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                  * Please click an account to send from
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {accounts.map((acc) => {
                const isSelected = selectedSourceAccount?.id === acc.id;
                const meta = getAccountMeta(acc.id);
                const colorPreset = COLOR_PRESETS[meta.color] || COLOR_PRESETS.slate;

                return (
                  <button
                    type="button"
                    key={acc.id}
                    onClick={() => {
                      setSelectedSourceAccount(acc);
                      setError(null);
                    }}
                    className={`flex flex-col p-3.5 rounded-2xl border text-left transition-all ${colorPreset.bgLight} ${colorPreset.bgDark} ${
                      isSelected
                        ? `${colorPreset.activeBorderLight} ${colorPreset.activeBorderDark} ${colorPreset.activeRing}`
                        : `${colorPreset.borderLight} ${colorPreset.borderDark} hover:border-slate-300 dark:hover:border-slate-700 shadow-sm`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`h-2.5 w-2.5 rounded-full ${colorPreset.dot} shrink-0`} />
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {meta.nickname || `${acc.account_type} #${acc.id}`}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className={`h-4 w-4 ${colorPreset.textLight} ${colorPreset.textDark} shrink-0`} />
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                      #{acc.id} • {formatAccountNumber(acc.account_number)}
                    </span>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                      {formatMoney(acc.balance, acc.currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Destination Account Input & Quick Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  2. To Recipient (10-Digit Account Number)
                </label>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  rawDigits.length === 10
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
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
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="">⚡ Select My Own Account</option>
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
                maxLength={14} // XXX-X-XXXXX-X format is 14 chars
                placeholder="XXX-X-XXXXX-X (e.g. 236-6-83905-9)"
                value={receiverInput}
                onChange={(e) => setReceiverInput(formatAccountInput(e.target.value))}
                className={`w-full rounded-xl border bg-white dark:bg-slate-950 py-3 px-3.5 text-sm font-mono tracking-wider text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-1 transition ${
                  recipientAccount
                    ? "border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500"
                    : recipientError
                    ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                    : "border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-white focus:ring-slate-900 dark:focus:ring-white"
                }`}
              />
              {verifyingRecipient && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-[11px]">Verifying...</span>
                </div>
              )}
            </div>

            {/* FULL RECIPIENT DETAILS CARD */}
            {recipientAccount && (
              <div className="mt-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 text-xs text-emerald-900 dark:text-emerald-300 animate-slide-up space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/70 dark:border-emerald-900/50">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold text-xs">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {recipientAccount.account_holder_name || "Verified Bank Customer"}
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Recipient Account Holder
                      </div>
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span>VERIFIED ACTIVE</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Account Number:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatAccountNumber(recipientAccount.account_number)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Account Type:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{recipientAccount.currency} • {recipientAccount.account_type}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Indicator */}
            {recipientError && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 animate-slide-up">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{recipientError}</span>
              </div>
            )}
          </div>

          {/* 3. Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                3. Amount (THB)
              </label>
              {selectedSourceAccount && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Available:{" "}
                  <span className="text-slate-900 dark:text-white font-mono font-bold">
                    {formatMoney(selectedSourceAccount.balance, selectedSourceAccount.currency)}
                  </span>
                </span>
              )}
            </div>

            <div className="relative">
              <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-lg font-mono transition-colors ${
                isOverBalance ? "text-rose-500" : "text-slate-400"
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
                className={`w-full rounded-xl border py-3 pl-9 pr-4 text-2xl font-bold font-mono transition-all focus:outline-none focus:ring-2 ${
                  isOverBalance
                    ? "border-rose-500 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 ring-rose-500/30 focus:border-rose-500 focus:ring-rose-500/40"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-white focus:ring-slate-900/20 dark:focus:ring-white/20"
                }`}
              />
            </div>

            {/* Inline Real-time Shortage Warning */}
            {isOverBalance && selectedSourceAccount && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/40 p-2.5 text-xs text-rose-700 dark:text-rose-300 animate-slide-up">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>
                    Exceeds balance ({formatMoney(selectedSourceAccount.balance, selectedSourceAccount.currency)}) by{" "}
                    <strong className="font-mono">{formatMoney(shortageSatang, selectedSourceAccount.currency)}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAmount((selectedSourceAccount.balance / 100).toString())}
                  className="rounded-lg bg-rose-200/80 dark:bg-rose-900/80 hover:bg-rose-300 dark:hover:bg-rose-800 px-2 py-0.5 text-[11px] font-bold text-rose-900 dark:text-rose-100 transition shrink-0 ml-2"
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
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  +{q.toLocaleString()} ฿
                </button>
              ))}
              {selectedSourceAccount && (
                <button
                  type="button"
                  onClick={() => setAmount((selectedSourceAccount.balance / 100).toString())}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Max Balance
                </button>
              )}
            </div>
          </div>

          {/* 4. Description Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              4. Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Dinner split, Rent..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-white focus:outline-none"
            />
          </div>

          {/* 5. Idempotency Key Info */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-mono truncate max-w-[200px] sm:max-w-xs">
                Key: {idempotencyKey}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIdempotencyKey(generateUUID());
                showToast("New Idempotency Key generated", "info");
              }}
              className="flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Regenerate</span>
            </button>
          </div>

          {/* Review & Send Button */}
          <button
            type="submit"
            disabled={!selectedSourceAccount || verifyingRecipient || !recipientAccount || isOverBalance || satangAmount <= 0}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition ${
              isOverBalance
                ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 cursor-not-allowed"
                : !selectedSourceAccount || verifyingRecipient || !recipientAccount || satangAmount <= 0
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 opacity-50 cursor-not-allowed"
                : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98]"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>
              {isOverBalance
                ? "Insufficient Balance in Source Account"
                : "Review & Confirm Transfer"}
            </span>
          </button>
        </form>
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
        onConfirm={handleExecuteTransfer}
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
