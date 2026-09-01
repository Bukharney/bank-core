"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useTheme } from "@/context/ThemeContext";
import { formatAccountNumber, formatMoney } from "@/lib/currency";
import { getAccountMeta, COLOR_PRESETS } from "@/lib/accountMeta";
import {
  Landmark,
  LogOut,
  Wallet,
  RefreshCw,
  ChevronDown,
  Cpu,
  CheckCircle2,
  LayoutDashboard,
  ArrowLeftRight,
  BookOpenText,
  Sun,
  Moon,
} from "lucide-react";
import ATMSimulatorModal from "./ATMSimulatorModal";

export default function Navbar() {
  const pathname = usePathname();
  const { user, accounts, activeAccount, setActiveAccount, refreshData, logout } = useAuth();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [showAtmSimulator, setShowAtmSimulator] = React.useState(false);
  const [metaUpdateCounter, setMetaUpdateCounter] = useState(0);

  useEffect(() => {
    const handleMetaChanged = () => {
      setMetaUpdateCounter((prev) => prev + 1);
    };
    window.addEventListener("bank-core-account-meta-changed", handleMetaChanged);
    return () => window.removeEventListener("bank-core-account-meta-changed", handleMetaChanged);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    showToast("Balance updated", "info");
    setTimeout(() => setRefreshing(false), 500);
  };

  if (!user) return null;

  const activeMeta = activeAccount ? getAccountMeta(activeAccount.id) : null;
  const activeColorPreset = activeMeta ? COLOR_PRESETS[activeMeta.color] || COLOR_PRESETS.slate : COLOR_PRESETS.slate;

  const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transfer", label: "Transfer Hub", icon: ArrowLeftRight },
    { href: "/ledger", label: "Ledger Explorer", icon: BookOpenText },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#070b14]/90 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Brand & Horizontal Nav Tabs */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-90">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
                <Landmark className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">BANK CORE</span>
                <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  PROD
                </span>
              </div>
            </Link>

            {/* Horizontal Nav Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Account Selector Dropdown with Color Dot & Nickname */}
            {accounts.length > 0 && activeAccount && (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${activeColorPreset.dot} shrink-0`} />
                  <div className="text-left leading-tight hidden sm:block">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[130px]">
                      {activeMeta?.nickname || `${activeAccount.account_type} • #${activeAccount.id}`}
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white font-mono text-xs">
                      {formatMoney(activeAccount.balance, activeAccount.currency)}
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl z-50 animate-slide-up">
                    <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Select Account ({accounts.length}/5)
                    </div>
                    <div className="space-y-1 mt-1">
                      {accounts.map((acc) => {
                        const meta = getAccountMeta(acc.id);
                        const colorPreset = COLOR_PRESETS[meta.color] || COLOR_PRESETS.slate;
                        const isCurrent = activeAccount.id === acc.id;

                        return (
                          <button
                            key={acc.id}
                            onClick={() => {
                              setActiveAccount(acc);
                              setDropdownOpen(false);
                              showToast(`Switched to Account #${acc.id}`, "info");
                            }}
                            className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                              isCurrent
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold flex items-center gap-1.5 truncate">
                                <span className={`h-2 w-2 rounded-full ${colorPreset.dot} shrink-0`} />
                                <span className="truncate">{meta.nickname || `${acc.account_type} #${acc.id}`}</span>
                                {isCurrent && (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                                )}
                              </div>
                              <div className={`text-[10px] font-mono ${isCurrent ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>
                                {formatAccountNumber(acc.account_number)}
                              </div>
                            </div>
                            <div className="font-mono font-bold text-right shrink-0">
                              {formatMoney(acc.balance, acc.currency)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ATM Simulator Trigger */}
            <button
              onClick={() => setShowAtmSimulator(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm active:scale-95"
            >
              <Cpu className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">ATM Simulator</span>
            </button>

            {/* Dark / Light Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 shadow-sm"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              title="Refresh Account Data"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-slate-900 dark:text-white" : ""}`} />
            </button>

            {/* Profile & Logout */}
            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-2 sm:pl-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700">
                  {user.first_name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="hidden lg:block text-left leading-tight">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                    {user.email}
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition active:scale-95 ml-1"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Horizontal Tabs Bar */}
        <div className="flex md:hidden border-t border-slate-100 dark:border-slate-800 px-4 py-2 bg-white dark:bg-[#070b14] gap-2 overflow-x-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0 transition ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {showAtmSimulator && (
        <ATMSimulatorModal
          onClose={() => setShowAtmSimulator(false)}
          onSuccess={() => {
            refreshData();
          }}
        />
      )}
    </>
  );
}
