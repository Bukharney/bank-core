"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useTheme } from "@/context/ThemeContext";
import { useSidebar } from "@/context/SidebarContext";
import { formatAccountNumber, formatMoney } from "@/lib/currency";
import { getAccountMeta, COLOR_PRESETS } from "@/lib/accountMeta";
import {
  LogOut,
  RefreshCw,
  ChevronDown,
  Check,
  Sun,
  Moon,
  Settings,
  Menu,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const { user, accounts, activeAccount, setActiveAccount, refreshData, logout } = useAuth();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { toggleMobileOpen } = useSidebar();

  const [refreshing, setRefreshing] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [, setMetaUpdateCounter] = useState(0);

  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Sync account metadata changes
  useEffect(() => {
    const handleMetaChanged = () => {
      setMetaUpdateCounter((prev) => prev + 1);
    };
    window.addEventListener("bank-core-account-meta-changed", handleMetaChanged);
    return () => window.removeEventListener("bank-core-account-meta-changed", handleMetaChanged);
  }, []);

  // Handle outside clicks and Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setAccountDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountDropdownOpen(false);
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Close menus on route navigation
  useEffect(() => {
    setAccountDropdownOpen(false);
    setUserDropdownOpen(false);
  }, [pathname]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshData();
      showToast("Balances synchronized", "info");
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  if (!user) return null;

  const activeMeta = activeAccount ? getAccountMeta(activeAccount.id) : null;
  const activeColorPreset = activeMeta ? COLOR_PRESETS[activeMeta.color] || COLOR_PRESETS.slate : COLOR_PRESETS.slate;

  // Compute dynamic page title
  const getPageInfo = () => {
    switch (pathname) {
      case "/":
        return { title: "Dashboard", category: "Banking Core" };
      case "/transfer":
        return { title: "Transfers", category: "Transactions" };
      case "/ledger":
        return { title: "Ledger", category: "Audit & Entries" };
      case "/settings":
        return { title: "Settings", category: "Account & Security" };
      default:
        return { title: "BankCore", category: "Platform" };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <header className="sticky top-0 z-20 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#070b14]/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Toggle + Breadcrumb / Page Title */}
        <div className="flex items-center gap-3">
          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={toggleMobileOpen}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open sidebar menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Dynamic Page Title & Section */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 hidden sm:inline">
              {pageInfo.category}
            </span>
            <span className="text-[11px] text-slate-300 dark:text-slate-600 hidden sm:inline">
              /
            </span>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-white">
              {pageInfo.title}
            </h1>
          </div>
        </div>

        {/* Right: Account Selector + Quick Theme Toggle + User Avatar */}
        <div className="flex items-center gap-2.5">
          {/* Account Selector Pill */}
          {accounts.length > 0 && activeAccount && (
            <div className="relative" ref={accountDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setAccountDropdownOpen(!accountDropdownOpen);
                  setUserDropdownOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  accountDropdownOpen
                    ? "border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80"
                    : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
                aria-label="Switch active account"
              >
                <span className={`h-2 w-2 rounded-full ${activeColorPreset.dot} shrink-0`} />
                <span className="text-slate-700 dark:text-slate-300 max-w-[110px] truncate hidden sm:inline">
                  {activeMeta?.nickname || activeAccount.account_type}
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {formatMoney(activeAccount.balance, activeAccount.currency)}
                </span>
                <ChevronDown
                  className={`h-3 w-3 text-slate-400 transition-transform ${
                    accountDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Account Switcher Popover */}
              {accountDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl z-50 animate-slide-up">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Accounts ({accounts.length})
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {accounts.map((acc) => {
                      const meta = getAccountMeta(acc.id);
                      const colorPreset = COLOR_PRESETS[meta.color] || COLOR_PRESETS.slate;
                      const isCurrent = activeAccount.id === acc.id;

                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setActiveAccount(acc);
                            setAccountDropdownOpen(false);
                            showToast(`Switched to ${meta.nickname || `Account #${acc.id}`}`, "info");
                          }}
                          className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                            isCurrent
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`h-2 w-2 rounded-full ${colorPreset.dot} shrink-0`} />
                              <span className="truncate">{meta.nickname || `${acc.account_type} #${acc.id}`}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pl-3.5">
                              {formatAccountNumber(acc.account_number)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                              {formatMoney(acc.balance, acc.currency)}
                            </span>
                            {isCurrent && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            aria-label="Toggle theme"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" />
            )}
          </button>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative" ref={userDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setAccountDropdownOpen(false);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition-transform hover:scale-105 ${
                userDropdownOpen ? "ring-2 ring-blue-500" : ""
              }`}
              aria-label="Open user menu"
            >
              {user.first_name?.[0]?.toUpperCase() || "U"}
            </button>

            {/* User Dropdown Popover */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl z-50 animate-slide-up">
                {/* User details */}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>

                {/* Actions & Utilities */}
                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleRefresh();
                      setUserDropdownOpen(false);
                    }}
                    disabled={refreshing}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
                    <span>Sync Balances</span>
                  </button>

                  <Link
                    href="/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5 text-slate-400" />
                    <span>Settings</span>
                  </Link>
                </div>

                {/* Sign Out */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
