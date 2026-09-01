"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, generateUUID } from "@/lib/api";
import { formatAccountNumber, formatAccountInput, formatMoney, formatDate, thbToSatang } from "@/lib/currency";
import { Account, LedgerEntry, TransferReceipt } from "@/lib/types";
import { getAccountMeta, COLOR_PRESETS } from "@/lib/accountMeta";
import ActionModal from "@/components/ActionModal";
import ReceiptModal from "@/components/ReceiptModal";
import TransferConfirmModal from "@/components/TransferConfirmModal";
import EditAccountModal from "@/components/EditAccountModal";
import Link from "next/link";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Plus,
  Copy,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  Activity,
  ChevronRight,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Tag,
  Pencil,
} from "lucide-react";

export default function DashboardPage() {
  const { user, accounts, activeAccount, setActiveAccount, refreshData, loading } = useAuth();
  const { showToast } = useToast();

  const [recentTransactions, setRecentTransactions] = useState<LedgerEntry[]>([]);
  const [modalType, setModalType] = useState<"deposit" | "withdraw" | null>(null);
  const [targetModalAccount, setTargetModalAccount] = useState<Account | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [creatingAccount, setCreatingAccount] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [hideBalance, setHideBalance] = useState<boolean>(false);
  const [metaUpdateCounter, setMetaUpdateCounter] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bank-core-hide-balance");
      if (saved === "true") {
        setHideBalance(true);
      }
    }
  }, []);

  useEffect(() => {
    const handleMetaChanged = () => {
      setMetaUpdateCounter((prev) => prev + 1);
    };
    window.addEventListener("bank-core-account-meta-changed", handleMetaChanged);
    return () => window.removeEventListener("bank-core-account-meta-changed", handleMetaChanged);
  }, []);

  const toggleHideBalance = () => {
    const next = !hideBalance;
    setHideBalance(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("bank-core-hide-balance", String(next));
    }
  };

  // Quick Transfer Widget State
  const [quickReceiverId, setQuickReceiverId] = useState<string>("");
  const [quickAmount, setQuickAmount] = useState<string>("");
  const [quickTransferring, setQuickTransferring] = useState<boolean>(false);
  const [quickReceipt, setQuickReceipt] = useState<TransferReceipt | null>(null);
  const [receiptSenderAccount, setReceiptSenderAccount] = useState<Account | null>(null);
  const [receiptReceiverAccount, setReceiptReceiverAccount] = useState<Account | null>(null);
  const [quickRecipientAccount, setQuickRecipientAccount] = useState<Account | null>(null);
  const [quickVerifying, setQuickVerifying] = useState<boolean>(false);
  const [quickRecipientError, setQuickRecipientError] = useState<string | null>(null);
  const [showQuickConfirmModal, setShowQuickConfirmModal] = useState<boolean>(false);

  // Other own accounts
  const otherOwnAccounts = accounts.filter((a) => a.id !== activeAccount?.id);

  useEffect(() => {
    async function loadRecent() {
      if (!activeAccount) return;
      try {
        const res = await api.ledger.getStatement(activeAccount.id, 8, 0);
        if (res.data) {
          setRecentTransactions(res.data);
        }
      } catch (err) {
        console.error("Failed to load recent ledger statement", err);
      }
    }
    loadRecent();
  }, [activeAccount]);

  // Debounced Quick Transfer Recipient Lookup (strictly requiring 10 digits)
  useEffect(() => {
    const cleanParam = quickReceiverId.replace(/\D/g, "");
    if (!cleanParam || cleanParam.length < 10) {
      setQuickRecipientAccount(null);
      setQuickRecipientError(null);
      setQuickVerifying(false);
      return;
    }

    if (
      activeAccount &&
      cleanParam === activeAccount.account_number.replace(/\D/g, "")
    ) {
      setQuickRecipientAccount(null);
      setQuickRecipientError("Cannot transfer to own account");
      setQuickVerifying(false);
      return;
    }

    setQuickVerifying(true);
    setQuickRecipientError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await api.accounts.getById(cleanParam);
        if (res.data && res.data.id && res.data.status === "ACTIVE") {
          setQuickRecipientAccount(res.data);
          setQuickRecipientError(null);
        } else {
          setQuickRecipientAccount(null);
          setQuickRecipientError("Account not found");
        }
      } catch {
        setQuickRecipientAccount(null);
        setQuickRecipientError("Account not found");
      } finally {
        setQuickVerifying(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [quickReceiverId, activeAccount]);

  const totalBalanceSatang = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);

  const handleCopy = (acc: Account) => {
    navigator.clipboard.writeText(acc.account_number);
    setCopiedId(acc.id);
    showToast(`Account number ${formatAccountNumber(acc.account_number)} copied!`, "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateAccount = async () => {
    if (accounts.length >= 5) {
      showToast("Maximum limit of 5 accounts per customer reached.", "error");
      return;
    }
    setCreatingAccount(true);
    try {
      const res = await api.accounts.create({
        account_type: "SAVINGS",
        currency: "THB",
      });
      if (res.data) {
        await refreshData();
        showToast("New Savings Account opened successfully!", "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to open new account", "error");
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleQuickReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || !quickRecipientAccount) return;

    const satang = thbToSatang(quickAmount);
    if (satang <= 0 || satang > activeAccount.balance) {
      showToast("Invalid transfer amount or insufficient balance", "error");
      return;
    }

    setShowQuickConfirmModal(true);
  };

  const handleExecuteQuickTransfer = async () => {
    if (!activeAccount || !quickRecipientAccount) return;

    setQuickTransferring(true);
    const satang = thbToSatang(quickAmount);

    try {
      const res = await api.transactions.transfer(
        {
          sender_account_id: activeAccount.id,
          receiver_account_id: quickRecipientAccount.id,
          amount: satang,
          currency: activeAccount.currency,
          description: "Quick Transfer from Dashboard",
        },
        generateUUID()
      );

      if (res.error) {
        showToast(res.error, "error");
        setShowQuickConfirmModal(false);
      } else if (res.data) {
        setShowQuickConfirmModal(false);
        setReceiptSenderAccount(activeAccount);
        setReceiptReceiverAccount(quickRecipientAccount);
        setQuickReceipt(res.data);
        showToast("Transfer successful!", "success");
        setQuickReceiverId("");
        setQuickAmount("");
        setQuickRecipientAccount(null);
        await refreshData();
      }
    } catch (err: any) {
      showToast(err.message || "Transfer failed", "error");
      setShowQuickConfirmModal(false);
    } finally {
      setQuickTransferring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-900 dark:border-white border-t-transparent" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Loading Core Banking data...</span>
        </div>
      </div>
    );
  }

  const currentAccount = activeAccount || accounts[0] || null;
  const currentBalanceSatang = currentAccount?.balance || 0;
  const currentCurrency = currentAccount?.currency || "THB";
  const currentMeta = currentAccount ? getAccountMeta(currentAccount.id) : null;
  const currentColorPreset = currentMeta ? COLOR_PRESETS[currentMeta.color] || COLOR_PRESETS.slate : COLOR_PRESETS.slate;
  const currentAccountLabel = currentMeta?.nickname || (currentAccount ? `${currentAccount.account_type} #${currentAccount.id}` : "Account");

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* 1. Balance Header & Quick Action Bar */}
      <div className={`rounded-3xl border ${currentColorPreset.borderLight} ${currentColorPreset.borderDark} ${currentColorPreset.bgLight} ${currentColorPreset.bgDark} p-6 sm:p-8 shadow-sm transition-all duration-300`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span className={`h-2.5 w-2.5 rounded-full ${currentColorPreset.dot} shrink-0`} />
              <span>Available Balance • {currentAccountLabel}</span>
              <button
                onClick={toggleHideBalance}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition ml-1"
                title={hideBalance ? "Show Balance" : "Hide Balance"}
              >
                {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
                {hideBalance ? "••••••••" : formatMoney(currentBalanceSatang, currentCurrency)}
              </h1>
              <span className={`rounded-lg ${currentColorPreset.badge} px-2 py-0.5 text-xs font-bold font-mono border`}>
                {currentCurrency}
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 pt-0.5 flex flex-wrap items-center gap-x-2">
              <span>Account: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currentAccount ? formatAccountNumber(currentAccount.account_number) : ""}</span></span>
              <span>•</span>
              <span>Customer: <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.first_name} {user?.last_name}</span></span>
              <span>•</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-medium font-mono">Verified Active Status</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/transfer"
              className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition shadow-sm"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span>Transfer</span>
            </Link>

            <button
              onClick={() => {
                setTargetModalAccount(activeAccount || accounts[0]);
                setModalType("deposit");
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition shadow-sm"
            >
              <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Deposit</span>
            </button>

            <button
              onClick={() => {
                setTargetModalAccount(activeAccount || accounts[0]);
                setModalType("withdraw");
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition shadow-sm"
            >
              <ArrowUpRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Cardless ATM</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Spacious 2-Column Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Bank Accounts Stack (7 Columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Your Bank Accounts</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {accounts.length}/5 Accounts
              </span>
              {accounts.length < 5 ? (
                <button
                  onClick={handleCreateAccount}
                  disabled={creatingAccount}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Open Account</span>
                </button>
              ) : (
                <span className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                  Max Limit (5/5)
                </span>
              )}
            </div>
          </div>

          {/* Accounts List */}
          <div className="space-y-3">
            {accounts.map((acc) => {
              const isSelected = activeAccount?.id === acc.id;
              const meta = getAccountMeta(acc.id);
              const colorPreset = COLOR_PRESETS[meta.color] || COLOR_PRESETS.slate;

              return (
                <div
                  key={acc.id}
                  onClick={() => {
                    if (activeAccount?.id !== acc.id) {
                      setActiveAccount(acc);
                      showToast(`Active Account switched to #${acc.id}`, "info");
                    }
                  }}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-5 transition-all cursor-pointer ${colorPreset.bgLight} ${colorPreset.bgDark} ${
                    isSelected
                      ? `${colorPreset.activeBorderLight} ${colorPreset.activeBorderDark} ${colorPreset.activeRing}`
                      : `${colorPreset.borderLight} ${colorPreset.borderDark} hover:border-slate-300 dark:hover:border-slate-700 shadow-sm`
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${colorPreset.dot} shrink-0`} />
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {meta.nickname || `${acc.account_type} Account`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingAccount(acc);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Customize Account Name & Color"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {isSelected && (
                        <span className={`rounded-full ${colorPreset.activeBadge} text-[9px] font-bold px-2 py-0.5 shrink-0 shadow-xs`}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                      <span>#{acc.id} • {formatAccountNumber(acc.account_number)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(acc);
                        }}
                        className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                        title="Copy Account Number"
                      >
                        {copiedId === acc.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                        {hideBalance ? "••••••••" : formatMoney(acc.balance, acc.currency)}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        ● {acc.status}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Account Card */}
            {accounts.length < 5 && (
              <button
                onClick={handleCreateAccount}
                disabled={creatingAccount}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-4 text-center hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <Plus className="h-4 w-4" />
                <span>Open Additional Bank Account ({accounts.length}/5)</span>
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Quick Transfer Widget & Recent Activity (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Transfer Widget */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/90 p-5 sm:p-6 shadow-sm space-y-4 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Transfer</h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                From #{activeAccount?.id}
              </span>
            </div>

            <form onSubmit={handleQuickReviewSubmit} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                      Recipient Account
                    </label>
                    <span className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded ${
                      quickReceiverId.replace(/\D/g, "").length === 10
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}>
                      {quickReceiverId.replace(/\D/g, "").length}/10
                    </span>
                  </div>
                  {otherOwnAccounts.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          setQuickReceiverId(formatAccountInput(e.target.value));
                        }
                      }}
                      value=""
                      className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                    >
                      <option value="">⚡ My Accounts</option>
                      {otherOwnAccounts.map((own) => {
                        const ownMeta = getAccountMeta(own.id);
                        return (
                          <option key={own.id} value={own.account_number}>
                            {ownMeta.nickname || `${own.account_type} #${own.id}`} ({formatAccountNumber(own.account_number)})
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="XXX-X-XXXXX-X (10 digits)"
                    value={quickReceiverId}
                    onChange={(e) => setQuickReceiverId(formatAccountInput(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-white focus:outline-none"
                  />
                  {quickVerifying && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </div>
                  )}
                </div>

                {quickRecipientAccount && (
                  <div className="mt-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300 animate-slide-up">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-900 dark:text-white">
                        {quickRecipientAccount.account_holder_name || "Verified Customer"}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Account #{quickRecipientAccount.id} • {formatAccountNumber(quickRecipientAccount.account_number)}
                    </div>
                  </div>
                )}

                {quickRecipientError && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{quickRecipientError}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                    Amount (THB)
                  </label>
                  {activeAccount && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Max: {formatMoney(activeAccount.balance, activeAccount.currency)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm font-mono ${
                    activeAccount && thbToSatang(quickAmount) > activeAccount.balance ? "text-rose-500" : "text-slate-400"
                  }`}>
                    ฿
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    className={`w-full rounded-xl border py-2 pl-7 pr-3 text-base font-bold font-mono transition-all focus:outline-none ${
                      activeAccount && thbToSatang(quickAmount) > activeAccount.balance
                        ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-white"
                    }`}
                  />
                </div>

                {/* Quick amount shortage warning */}
                {activeAccount && thbToSatang(quickAmount) > activeAccount.balance && (
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                    <span>⚠️ Exceeds balance by {formatMoney(thbToSatang(quickAmount) - activeAccount.balance, activeAccount.currency)}</span>
                    <button
                      type="button"
                      onClick={() => setQuickAmount((activeAccount.balance / 100).toString())}
                      className="font-bold underline text-rose-700 dark:text-rose-300"
                    >
                      Use Max
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!quickRecipientAccount || !quickAmount || (activeAccount ? thbToSatang(quickAmount) > activeAccount.balance : false)}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white py-2.5 text-xs font-semibold text-white dark:text-slate-900 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>
                  {activeAccount && thbToSatang(quickAmount) > activeAccount.balance
                    ? "Insufficient Balance"
                    : "Review Transfer"}
                </span>
              </button>
            </form>
          </div>

          {/* Recent Activity Feed */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/90 p-5 sm:p-6 shadow-sm space-y-3 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Activity</h3>
              </div>
              <Link
                href="/ledger"
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1"
              >
                <span>Ledger</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No recent transactions recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentTransactions.slice(0, 5).map((tx) => {
                  const isCredit = tx.entry_type === "CREDIT";
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs ${
                            isCredit
                              ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                              : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {isCredit ? "Deposit / Inflow" : "Transfer / Outflow"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {formatDate(tx.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-xs font-bold font-mono ${
                            isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {isCredit ? "+" : "-"}
                          {formatMoney(tx.amount)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Modal (Deposit / Cardless ATM Ticket) */}
      <ActionModal
        type={modalType}
        account={targetModalAccount}
        onClose={() => {
          setModalType(null);
          setTargetModalAccount(null);
        }}
        onSuccess={() => {
          refreshData();
          showToast("Transaction executed successfully!", "success");
        }}
      />

      {/* Quick Transfer Confirmation Modal */}
      <TransferConfirmModal
        isOpen={showQuickConfirmModal}
        senderAccount={activeAccount}
        receiverAccount={quickRecipientAccount}
        amountSatang={thbToSatang(quickAmount)}
        description="Quick Transfer from Dashboard"
        loading={quickTransferring}
        onClose={() => setShowQuickConfirmModal(false)}
        onConfirm={handleExecuteQuickTransfer}
      />

      {/* Edit Account Modal */}
      <EditAccountModal
        isOpen={!!editingAccount}
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onSaved={() => {
          setMetaUpdateCounter((prev) => prev + 1);
        }}
      />

      {/* Quick Transfer Receipt */}
      <ReceiptModal
        receipt={quickReceipt}
        senderAccount={receiptSenderAccount}
        receiverAccount={receiptReceiverAccount}
        onClose={() => {
          setQuickReceipt(null);
          setReceiptSenderAccount(null);
          setReceiptReceiverAccount(null);
        }}
      />
    </div>
  );
}
