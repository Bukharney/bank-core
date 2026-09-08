"use client";

import React, { useState, useEffect } from "react";
import { Account } from "@/lib/types";
import { COLOR_PRESETS, getAccountMeta, setAccountMeta } from "@/lib/accountMeta";
import { formatAccountNumber } from "@/lib/currency";
import { useToast } from "@/context/ToastContext";
import { X, Tag, Check, Sparkles, Shield } from "lucide-react";

interface EditAccountModalProps {
  account: Account | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const NICKNAME_SUGGESTIONS = [
  "Main Salary",
  "Emergency Vault",
  "Daily Expenses",
  "Sovereign Reserve",
  "Securities / Stocks",
  "Crypto Ingress",
];

export default function EditAccountModal({
  account,
  isOpen,
  onClose,
  onSaved,
}: EditAccountModalProps) {
  const { showToast } = useToast();
  const [nickname, setNickname] = useState("");
  const [selectedColor, setSelectedColor] = useState("bullion");

  useEffect(() => {
    if (account) {
      const meta = getAccountMeta(account.id);
      setNickname(meta.nickname || "");
      setSelectedColor(meta.color || "bullion");
    }
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMeta(account.id, {
      nickname: nickname.trim(),
      color: selectedColor,
    });
    showToast(`Account #${account.id} labeled with ${COLOR_PRESETS[selectedColor]?.name || selectedColor}!`, "success");
    onSaved();
    onClose();
  };

  const currentColorPreset = COLOR_PRESETS[selectedColor] || COLOR_PRESETS.bullion;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md my-auto max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200/80 dark:border-vault-border bg-white dark:bg-vault-card p-6 sm:p-8 shadow-2xl dark:shadow-card-depth animate-slide-up space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-vault-surface text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="mx-auto relative flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 dark:bg-vault-surface border dark:border-bullion-500/30 text-bullion-400 shadow-xs dark:shadow-bullion-glow">
            <Tag className="h-6 w-6 text-bullion-400" />
            <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-ledger-credit border-2 border-white dark:border-vault-card" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Vault Customization
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Account #{account.id} • {formatAccountNumber(account.account_number)}
          </p>
        </div>

        {/* Live Preview Card */}
        <div
          className={`rounded-2xl border p-4 transition-all duration-200 ${currentColorPreset.bgLight} ${currentColorPreset.bgDark} ${currentColorPreset.borderLight} ${currentColorPreset.borderDark}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Simulated EMV Smart Chip Preview */}
              <div className={`w-5 h-3.5 rounded-[2px] bg-gradient-to-br ${currentColorPreset.chip} border flex items-center justify-center shadow-xs shrink-0`}>
                <div className="w-2.5 h-1.5 border border-black/20 rounded-[1px]" />
              </div>
              <span className={`text-xs font-bold ${currentColorPreset.textLight} ${currentColorPreset.textDark}`}>
                {nickname.trim() || `${account.account_type} Vault`}
              </span>
            </div>
            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${currentColorPreset.badge}`}>
              {currentColorPreset.name}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400">
              {formatAccountNumber(account.account_number)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {account.account_type}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Nickname Input */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Vault Nickname
            </label>
            <input
              type="text"
              maxLength={30}
              placeholder="e.g. Sovereign Reserve, Emergency Vault..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2.5 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-bullion-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-bullion-400/30 transition"
            />

            {/* Quick Suggestions */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NICKNAME_SUGGESTIONS.map((sug) => (
                <button
                  type="button"
                  key={sug}
                  onClick={() => setNickname(sug)}
                  className="rounded-lg border border-slate-200 dark:border-vault-border bg-slate-50 dark:bg-vault-surface px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-bullion-300 hover:bg-slate-100 dark:hover:bg-vault-elevated transition"
                >
                  +{sug}
                </button>
              ))}
            </div>
          </div>

          {/* Swiss Vault Color Palette Selector */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Swiss Vault Metal Label
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.values(COLOR_PRESETS).map((preset) => {
                const isSelected = selectedColor === preset.id;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => setSelectedColor(preset.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left ${
                      isSelected
                        ? "border-bullion-500/80 dark:border-bullion-400 bg-bullion-500/10 dark:bg-vault-elevated ring-1 ring-bullion-500/40 shadow-xs dark:shadow-bullion-glow"
                        : "border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface hover:border-slate-300 dark:hover:border-vault-highlight"
                    }`}
                    title={preset.name}
                  >
                    <span className={`h-4 w-4 rounded-full ${preset.dot} shrink-0 flex items-center justify-center shadow-xs`}>
                      {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate text-slate-900 dark:text-white leading-tight">
                        {preset.name.replace(/^(Sovereign|Alpine|Billet|Vault|Reserve)\s+/i, "")}
                      </div>
                      <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate">
                        {preset.id}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-bullion-500 dark:hover:bg-bullion-400 dark:text-vault-obsidian py-3 text-xs font-mono font-bold uppercase tracking-wider text-white shadow-xs dark:shadow-bullion-glow hover:bg-slate-800 active:scale-[0.98] transition"
            >
              <span>Apply Customization</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
