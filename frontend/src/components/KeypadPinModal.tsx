"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Lock, Delete, X, AlertCircle, Loader2, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

interface KeypadPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<void>;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

export default function KeypadPinModal({
  isOpen,
  onClose,
  onSubmit,
  title = "Enter Security PIN",
  subtitle = "Enter your 6-digit transaction PIN to authorize this transfer",
  loading = false,
  error = null,
  onClearError,
}: KeypadPinModalProps) {
  const [pin, setPin] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Clear pin on open/close
  useEffect(() => {
    if (isOpen) {
      setPin("");
    }
  }, [isOpen]);

  // Shake animation on error
  useEffect(() => {
    if (error) {
      setIsShaking(true);
      const timer = setTimeout(() => {
        setIsShaking(false);
        setPin(""); // Clear on error so user can re-try immediately
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (loading) return;
      if (onClearError && error) onClearError();

      setPin((prev) => {
        if (prev.length >= 6) return prev;
        const next = prev + digit;
        if (next.length === 6) {
          // Auto-submit on 6th digit
          setTimeout(() => {
            onSubmit(next);
          }, 50);
        }
        return next;
      });
    },
    [loading, error, onClearError, onSubmit]
  );

  const handleDelete = useCallback(() => {
    if (loading) return;
    if (onClearError && error) onClearError();
    setPin((prev) => prev.slice(0, -1));
  }, [loading, error, onClearError]);

  const handleClear = useCallback(() => {
    if (loading) return;
    if (onClearError && error) onClearError();
    setPin("");
  }, [loading, error, onClearError]);

  // Physical Keyboard Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleDigit, handleDelete, onClose]);

  if (!isOpen) return null;

  const isLocked = error && error.toLowerCase().includes("locked");
  const isUnconfigured = error && error.toLowerCase().includes("not configured");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className={`relative w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl transition-all duration-200 ${
          isShaking ? "animate-shake" : ""
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 rounded-full p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 shadow-sm">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 px-2 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 text-left">
              <div>{error}</div>
              {(isLocked || isUnconfigured) && (
                <Link
                  href="/settings"
                  onClick={onClose}
                  className="mt-2 inline-flex items-center gap-1 font-bold text-rose-800 dark:text-rose-300 underline hover:no-underline"
                >
                  <span>Go to Settings to {isUnconfigured ? "Set up PIN" : "Reset PIN"}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* 6-Dot PIN Indicator */}
        <div className="flex items-center justify-center gap-3.5 my-6">
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < pin.length;
            return (
              <div
                key={index}
                className={`h-4 w-4 rounded-full border transition-all duration-200 ${
                  isFilled
                    ? "scale-110 border-slate-900 dark:border-white bg-slate-900 dark:bg-white shadow-[0_0_10px_rgba(15,23,42,0.4)] dark:shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                    : error
                    ? "border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30"
                    : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60"
                }`}
              />
            );
          })}
        </div>

        {/* Loading Overlay or Keypad */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Verifying Authorization...
            </div>
          </div>
        ) : (
          /* Numeric Keypad Grid (3x4) */
          <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="flex h-14 items-center justify-center rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-lg font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition shadow-sm"
              >
                {num}
              </button>
            ))}

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              className="flex h-14 items-center justify-center rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-800/20 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
            >
              Clear
            </button>

            {/* Zero Key */}
            <button
              type="button"
              onClick={() => handleDigit("0")}
              className="flex h-14 items-center justify-center rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-lg font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition shadow-sm"
            >
              0
            </button>

            {/* Backspace Key */}
            <button
              type="button"
              onClick={handleDelete}
              className="flex h-14 items-center justify-center rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-800/20 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
              title="Delete"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Security Note */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          <span>Protected with cryptographic bcrypt ledger authorization</span>
        </div>
      </div>
    </div>
  );
}
