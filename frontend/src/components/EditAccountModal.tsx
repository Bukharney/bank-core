"use client";

import React, { useState, useEffect } from "react";
import { Account } from "@/lib/types";
import { COLOR_PRESETS, getAccountMeta, setAccountMeta } from "@/lib/accountMeta";
import { formatAccountNumber } from "@/lib/currency";
import { useToast } from "@/context/ToastContext";
import { X, Tag, Palette, Check, Sparkles } from "lucide-react";

interface EditAccountModalProps {
  account: Account | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const NICKNAME_SUGGESTIONS = [
  "Main Salary",
  "Emergency Fund",
  "Daily Expenses",
  "Travel Jar",
  "Investment / Stocks",
  "Savings Goal",
];

export default function EditAccountModal({
  account,
  isOpen,
  onClose,
  onSaved,
}: EditAccountModalProps) {
  const { showToast } = useToast();
  const [nickname, setNickname] = useState("");
  const [selectedColor, setSelectedColor] = useState("slate");

  useEffect(() => {
    if (account) {
      const meta = getAccountMeta(account.id);
      setNickname(meta.nickname || "");
      setSelectedColor(meta.color || "slate");
    }
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMeta(account.id, {
      nickname: nickname.trim(),
      color: selectedColor,
    });
    showToast(`Account #${account.id} label updated!`, "success");
    onSaved();
    onClose();
  };

  const currentColorPreset = COLOR_PRESETS[selectedColor] || COLOR_PRESETS.slate;

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

        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
            <Tag className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Account Customization
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Set custom nickname and color label for Account #{account.id} ({formatAccountNumber(account.account_number)})
          </p>
        </div>

        {/* Live Preview Card */}
        <div
          className={`rounded-2xl border p-4 transition-all duration-200 ${currentColorPreset.bgLight} ${currentColorPreset.bgDark} ${currentColorPreset.borderLight} ${currentColorPreset.borderDark}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${currentColorPreset.dot}`} />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {nickname.trim() || `${account.account_type} Account`}
              </span>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${currentColorPreset.badge}`}>
              {account.account_type}
            </span>
          </div>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {formatAccountNumber(account.account_number)}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Nickname Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Account Nickname
            </label>
            <input
              type="text"
              maxLength={30}
              placeholder="e.g. Main Salary, Emergency Jar..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2.5 px-3 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-slate-900 dark:focus:border-white focus:outline-none"
            />

            {/* Quick Suggestions */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NICKNAME_SUGGESTIONS.map((sug) => (
                <button
                  type="button"
                  key={sug}
                  onClick={() => setNickname(sug)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  +{sug}
                </button>
              ))}
            </div>
          </div>

          {/* Color Palette Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Color Label
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {Object.values(COLOR_PRESETS).map((preset) => {
                const isSelected = selectedColor === preset.id;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => setSelectedColor(preset.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? "border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 ring-2 ring-slate-900 dark:ring-white shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                    title={preset.name}
                  >
                    <span className={`h-5 w-5 rounded-full ${preset.dot} flex items-center justify-center`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="text-[9px] font-semibold truncate max-w-full text-slate-600 dark:text-slate-400">
                      {preset.id}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 dark:bg-white py-3 text-sm font-semibold text-white dark:text-slate-900 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98] transition"
            >
              Save Customization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
