"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, generateUUID } from "@/lib/api";
import { formatAccountInput, formatAccountNumber, thbToSatang } from "@/lib/currency";
import { Account, AccountPreview, LedgerEntry, TransferReceipt } from "@/lib/types";
import ActionModal from "@/components/ActionModal";
import ReceiptModal from "@/components/ReceiptModal";
import TransferConfirmModal from "@/components/TransferConfirmModal";
import EditAccountModal from "@/components/EditAccountModal";
import QuickActions from "@/components/dashboard/QuickActions";
import AccountCard from "@/components/dashboard/AccountCard";
import QuickTransferWidget from "@/components/dashboard/QuickTransferWidget";
import RecentActivity from "@/components/dashboard/RecentActivity";
import SecurityStatusCard from "@/components/dashboard/SecurityStatusCard";
import { useSidebar } from "@/context/SidebarContext";
import { CreditCard, Plus, Banknote, ArrowDownCircle, ArrowUpCircle, ShieldCheck, Sparkles, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user, accounts, activeAccount, setActiveAccount, refreshData, loading } = useAuth();
  const { showToast } = useToast();
  const { openAtmSimulator } = useSidebar();

  const [recentTransactions, setRecentTransactions] = useState<LedgerEntry[]>([]);
  const [modalType, setModalType] = useState<"deposit" | "withdraw" | null>(null);
  const [targetModalAccount, setTargetModalAccount] = useState<Account | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [creatingAccount, setCreatingAccount] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [hideBalance, setHideBalance] = useState<boolean>(false);
  const [, setMetaUpdateCounter] = useState<number>(0);

  // Quick Transfer Widget State
  const [quickReceiverId, setQuickReceiverId] = useState<string>("");
  const [quickAmount, setQuickAmount] = useState<string>("");
  const [quickTransferring, setQuickTransferring] = useState<boolean>(false);
  const [quickReceipt, setQuickReceipt] = useState<TransferReceipt | null>(null);
  const [receiptSenderAccount, setReceiptSenderAccount] = useState<Account | null>(null);
  const [receiptReceiverAccount, setReceiptReceiverAccount] = useState<Account | AccountPreview | null>(null);
  const [quickRecipientAccount, setQuickRecipientAccount] = useState<AccountPreview | null>(null);
  const [quickVerifying, setQuickVerifying] = useState<boolean>(false);
  const [quickRecipientError, setQuickRecipientError] = useState<string | null>(null);
  const [showQuickConfirmModal, setShowQuickConfirmModal] = useState<boolean>(false);

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

  // Debounced Quick Transfer Recipient Lookup (requiring 10 digits)
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
        const res = await api.accounts.getPreview(cleanParam);
        if (res.data && res.data.id && res.data.status === "ACTIVE") {
          setQuickRecipientAccount(res.data);
          setQuickRecipientError(null);
        } else {
          setQuickRecipientAccount(null);
          setQuickRecipientError(res.error || "Account not found");
        }
      } catch (err: any) {
        setQuickRecipientAccount(null);
        setQuickRecipientError(err?.message || "Account not found");
      } finally {
        setQuickVerifying(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [quickReceiverId, activeAccount]);

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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-bullion-500 border-t-transparent" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wider uppercase">
            Synchronizing Core Ledger Engine...
          </span>
        </div>
      </div>
    );
  }

  const otherOwnAccounts = accounts.filter((a) => a.id !== activeAccount?.id);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Security Status Reminder */}
      <SecurityStatusCard user={user} />

      {/* Hero Balance Header & Action Bar */}
      <QuickActions
        currentAccount={activeAccount || accounts[0] || null}
        user={user}
        hideBalance={hideBalance}
        onToggleHideBalance={toggleHideBalance}
        onDeposit={(acc) => {
          setTargetModalAccount(acc);
          setModalType("deposit");
        }}
        onWithdraw={(acc) => {
          setTargetModalAccount(acc);
          setModalType("withdraw");
        }}
      />

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Bank Accounts Stack & Transactions (7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-600 dark:text-bullion-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">My Bank Accounts</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {accounts.length}/5 Accounts
                </span>
                {accounts.length < 5 ? (
                  <button
                    onClick={handleCreateAccount}
                    disabled={creatingAccount}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-vault-border bg-white dark:bg-vault-surface px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-vault-highlight transition shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5 text-bullion-500" />
                    <span>Open Account</span>
                  </button>
                ) : (
                  <span className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                    Max Limit (5/5)
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {accounts.map((acc) => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  isSelected={activeAccount?.id === acc.id}
                  hideBalance={hideBalance}
                  copiedId={copiedId}
                  onSelect={(selected) => {
                    if (activeAccount?.id !== selected.id) {
                      setActiveAccount(selected);
                      showToast(`Active Account switched to #${selected.id}`, "info");
                    }
                  }}
                  onCopy={handleCopy}
                  onEdit={(editing) => setEditingAccount(editing)}
                />
              ))}

              {accounts.length < 5 && (
                <button
                  onClick={handleCreateAccount}
                  disabled={creatingAccount}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 dark:border-vault-border bg-slate-50/50 dark:bg-vault-surface/40 p-4 text-center hover:border-slate-400 dark:hover:border-vault-highlight hover:bg-slate-100/60 dark:hover:bg-vault-surface transition text-xs font-bold font-mono text-slate-700 dark:text-slate-300"
                >
                  <Plus className="h-4 w-4 text-bullion-500" />
                  <span>Open Additional Account ({accounts.length}/5)</span>
                </button>
              )}
            </div>
          </div>

          {/* Settled Transactions below Accounts */}
          <RecentActivity recentTransactions={recentTransactions} />
        </div>

        {/* RIGHT COLUMN: Quick Send Money & Friendly Services (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          <QuickTransferWidget
            activeAccount={activeAccount}
            otherOwnAccounts={otherOwnAccounts}
            quickReceiverId={quickReceiverId}
            quickAmount={quickAmount}
            quickRecipientAccount={quickRecipientAccount}
            quickVerifying={quickVerifying}
            quickRecipientError={quickRecipientError}
            onReceiverIdChange={(val) => setQuickReceiverId(formatAccountInput(val))}
            onAmountChange={(val) => setQuickAmount(val)}
            onSubmit={handleQuickReviewSubmit}
          />

          {/* Cardless Cash & ATM Services Card */}
          <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 sm:p-6 shadow-xs dark:shadow-milled space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2DDD0] dark:border-vault-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-vault-surface text-emerald-600 dark:text-ledger-credit">
                  <Banknote className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                    Cardless Cash & ATM
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    Express Kiosk Service
                  </span>
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase font-bold text-emerald-700 dark:text-ledger-credit bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-500/20 px-2 py-0.5 rounded">
                ● ATM Ready
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              Withdraw or deposit cash instantly at any Bank Core terminal without a physical card.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => openAtmSimulator({ showPortSelector: false })}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-vault-border bg-slate-50/70 dark:bg-vault-surface/60 hover:border-emerald-500/50 dark:hover:border-vault-highlight transition text-center group"
              >
                <ArrowDownCircle className="h-5 w-5 mb-1 text-emerald-600 dark:text-ledger-credit group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Deposit Cash</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">PromptPay Phone</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetModalAccount(activeAccount);
                  setModalType("withdraw");
                }}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-vault-border bg-slate-50/70 dark:bg-vault-surface/60 hover:border-bullion-500/50 dark:hover:border-vault-highlight transition text-center group"
              >
                <ArrowUpCircle className="h-5 w-5 mb-1 text-bullion-600 dark:text-bullion-400 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Cash Out</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">6-Digit Code</span>
              </button>
            </div>
          </div>

          {/* Account Security Overview Card */}
          <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card p-5 shadow-xs dark:shadow-milled space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-ledger-credit" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Account Protection
                </span>
              </div>
              <Link
                href="/settings"
                className="text-[11px] font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-0.5"
              >
                <span>Manage</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-vault-border/60">
                <span className="text-slate-500 dark:text-slate-400">Transfer Security</span>
                <span className="font-semibold text-emerald-600 dark:text-ledger-credit">6-Digit PIN Protected</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-vault-border/60">
                <span className="text-slate-500 dark:text-slate-400">PromptPay Link</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user?.phone_number ? "Linked & Active" : "Available to Link"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400">Daily Transfer Limit</span>
                <span className="font-bold text-slate-900 dark:text-white">฿50,000.00 / day</span>
              </div>
            </div>
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
