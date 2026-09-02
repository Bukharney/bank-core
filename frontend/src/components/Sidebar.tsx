"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import {
  Landmark,
  LayoutDashboard,
  ArrowLeftRight,
  BookOpenText,
  Cpu,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import ATMSimulatorModal from "./ATMSimulatorModal";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, refreshData } = useAuth();
  const {
    isCollapsed,
    toggleCollapsed,
    isMobileOpen,
    closeMobile,
    showAtmSimulator,
    setShowAtmSimulator,
    openAtmSimulator,
  } = useSidebar();

  // Close mobile drawer on route change
  useEffect(() => {
    closeMobile();
  }, [pathname]);

  // Handle ESC key for mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        closeMobile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  if (!user) return null;

  const navLinks = [
    {
      href: "/",
      label: "Dashboard",
      subtitle: "Overview & Accounts",
      icon: LayoutDashboard,
    },
    {
      href: "/transfer",
      label: "Transfers",
      subtitle: "Atomic P2P & External",
      icon: ArrowLeftRight,
    },
    {
      href: "/ledger",
      label: "Ledger",
      subtitle: "Double-Entry Audit",
      icon: BookOpenText,
    },
  ];

  const toolLinks = [
    {
      id: "atm",
      label: "ATM Simulator",
      subtitle: "Hardware Keypad Demo",
      icon: Cpu,
      onClick: openAtmSimulator,
    },
    {
      href: "/settings",
      label: "Settings",
      subtitle: "Profile & Security",
      icon: Settings,
    },
  ];

  const sidebarContent = (isMobile: boolean = false) => {
    const collapsed = !isMobile && isCollapsed;

    return (
      <div className="flex h-full flex-col justify-between overflow-x-hidden">
        <div className="space-y-6">
          {/* Brand Header */}
          <div
            className={`flex items-center h-14 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 ${
              collapsed ? "justify-center px-0" : "justify-between px-4"
            }`}
          >
            <Link
              href="/"
              className={`flex items-center gap-2.5 transition-transform hover:opacity-90 ${
                collapsed ? "justify-center" : ""
              }`}
              title="BankCore"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
                <Landmark className="h-4 w-4" />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                    BankCore
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Core Engine
                  </span>
                </div>
              )}
            </Link>

            {isMobile && (
              <button
                type="button"
                onClick={closeMobile}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {!isMobile && !collapsed && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                aria-label="Collapse sidebar (Ctrl+B)"
                title="Collapse sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Navigation Section */}
          <div className={`${collapsed ? "px-2" : "px-3"} space-y-5`}>
            <div>
              {!collapsed && (
                <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Navigation
                </div>
              )}
              <nav className="space-y-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      title={collapsed ? link.label : undefined}
                      className={`group flex items-center transition-all ${
                        collapsed
                          ? "h-10 w-10 mx-auto justify-center rounded-xl"
                          : "gap-3 rounded-xl px-2.5 py-2 text-xs font-medium"
                      } ${
                        isActive
                          ? "bg-slate-900 text-white dark:bg-slate-800 dark:text-white dark:ring-1 dark:ring-slate-700/80 font-semibold shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-white dark:text-white"
                            : "text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white"
                        }`}
                      />
                      {!collapsed && (
                        <div className="min-w-0 flex-1 truncate">
                          <div>{link.label}</div>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Tools & System Section */}
            <div>
              {!collapsed && (
                <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Tools & System
                </div>
              )}
              <div className="space-y-1">
                {toolLinks.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = tool.href ? pathname === tool.href : false;

                  if (tool.onClick) {
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={tool.onClick}
                        title={collapsed ? tool.label : undefined}
                        className={`group flex items-center transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white ${
                          collapsed
                            ? "h-10 w-10 mx-auto justify-center rounded-xl"
                            : "w-full gap-3 rounded-xl px-2.5 py-2 text-xs font-medium text-left"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white" />
                        {!collapsed && (
                          <div className="min-w-0 flex-1 truncate">
                            <div>{tool.label}</div>
                          </div>
                        )}
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={tool.href}
                      href={tool.href!}
                      title={collapsed ? tool.label : undefined}
                      className={`group flex items-center transition-all ${
                        collapsed
                          ? "h-10 w-10 mx-auto justify-center rounded-xl"
                          : "gap-3 rounded-xl px-2.5 py-2 text-xs font-medium"
                      } ${
                        isActive
                          ? "bg-slate-900 text-white dark:bg-slate-800 dark:text-white dark:ring-1 dark:ring-slate-700/80 font-semibold shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-white dark:text-white"
                            : "text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white"
                        }`}
                      />
                      {!collapsed && (
                        <div className="min-w-0 flex-1 truncate">
                          <div>{tool.label}</div>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div
          className={`border-t border-slate-200/80 dark:border-slate-800/80 space-y-2 shrink-0 ${
            collapsed ? "p-2" : "p-3"
          }`}
        >
          {!collapsed ? (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  Core Engine :8080
                </span>
              </div>
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                Active
              </span>
            </div>
          ) : (
            <div
              className="flex justify-center py-1 cursor-pointer"
              title="Core Engine :8080 · Active"
              onClick={toggleCollapsed}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>
          )}

          {collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="h-10 w-10 mx-auto flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              title="Expand sidebar (Ctrl+B)"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden md:block sticky top-0 h-screen shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#070b14]/95 backdrop-blur-md transition-[width] duration-200 ease-in-out z-30 ${
          isCollapsed ? "w-16" : "w-60"
        }`}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={closeMobile}
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[80vw] bg-white dark:bg-[#070b14] border-r border-slate-200 dark:border-slate-800 shadow-2xl z-50 animate-slide-right">
            {sidebarContent(true)}
          </div>
        </div>
      )}

      {/* ATM Simulator Modal */}
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
