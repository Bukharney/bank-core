"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { User, UserRole } from "@/lib/types";
import { formatDate } from "@/lib/currency";
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Banknote,
  User as UserIcon,
  Search,
  RefreshCw,
  Edit2,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const PAGE_SIZE = 20;

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // System-wide breakdown counts for metric cards
  const [systemCounts, setSystemCounts] = useState({
    total: 0,
    admin: 0,
    auditor: 0,
    teller: 0,
    user: 0,
  });

  // Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>("user");
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchBreakdown = async () => {
    try {
      const [allRes, adminRes, auditorRes, tellerRes, userRes] = await Promise.all([
        api.admin.listUsers(1, 0, "", "ALL"),
        api.admin.listUsers(1, 0, "", "admin"),
        api.admin.listUsers(1, 0, "", "auditor"),
        api.admin.listUsers(1, 0, "", "teller"),
        api.admin.listUsers(1, 0, "", "user"),
      ]);
      setSystemCounts({
        total: allRes.data?.total ?? 0,
        admin: adminRes.data?.total ?? 0,
        auditor: auditorRes.data?.total ?? 0,
        teller: tellerRes.data?.total ?? 0,
        user: userRes.data?.total ?? 0,
      });
    } catch {
      // ignore
    }
  };

  const fetchUsers = async (pageNum = page, query = searchQuery, role = roleFilter) => {
    setLoading(true);
    try {
      const res = await api.admin.listUsers(PAGE_SIZE, pageNum * PAGE_SIZE, query, role);
      if (res.data) {
        setUsers(res.data.users ?? []);
        setTotal(res.data.total ?? 0);
      } else if (res.error) {
        showToast(res.error, "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to load user directory", "error");
    } finally {
      setLoading(false);
    }
  };

  // Debounced search & filter trigger (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(0);
      fetchUsers(0, searchQuery, roleFilter);
    }, 350);

    return () => clearTimeout(handler);
  }, [searchQuery, roleFilter]);

  useEffect(() => {
    fetchBreakdown();
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage < 0) return;
    setPage(newPage);
    fetchUsers(newPage, searchQuery, roleFilter);
  };

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setTargetRole(user.role);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentUser?.id && targetRole !== "admin") {
      showToast("You cannot demote yourself from the Administrator role", "error");
      return;
    }

    setUpdating(true);
    try {
      const res = await api.admin.updateUserRole(selectedUser.id, targetRole);
      if (res.data) {
        showToast(`Role updated to ${targetRole.toUpperCase()} for ${selectedUser.username}`, "success");
        // Update locally
        setUsers((prev) =>
          prev.map((u) => (u.id === selectedUser.id ? { ...u, role: targetRole } : u))
        );
        fetchBreakdown();
        setSelectedUser(null);
      } else {
        showToast(res.error || "Failed to update role", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update role", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
  };

  const handleRoleFilter = (role: string) => {
    setRoleFilter(role);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setRoleFilter("ALL");
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  const getRoleBadge = (role: UserRole | string) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30">
            <ShieldAlert className="w-3 h-3" /> ADMIN
          </span>
        );
      case "auditor":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-bullion-500/10 text-bullion-700 dark:text-bullion-400 border border-bullion-500/30">
            <ShieldCheck className="w-3 h-3" /> AUDITOR
          </span>
        );
      case "teller":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30">
            <Banknote className="w-3 h-3" /> TELLER
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-ledger-credit border border-emerald-500/30">
            <UserIcon className="w-3 h-3" /> CUSTOMER
          </span>
        );
    }
  };

  const roleOptions: { role: UserRole; title: string; description: string; icon: any }[] = [
    {
      role: "admin",
      title: "Administrator",
      description: "Unrestricted access: system telemetry, user roles, core operations, and ATM clusters.",
      icon: ShieldAlert,
    },
    {
      role: "auditor",
      title: "Auditor",
      description: "Read-only global inspection: view general ledger and statements across all accounts.",
      icon: ShieldCheck,
    },
    {
      role: "teller",
      title: "Teller",
      description: "Front-desk operations: cash deposits, cardless withdrawal verifications, and user lookup.",
      icon: Banknote,
    },
    {
      role: "user",
      title: "Customer",
      description: "Personal banking customer: send money, view own accounts, cardless ATM withdrawals.",
      icon: UserIcon,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2DDD0] dark:border-vault-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 dark:bg-vault-surface border border-bullion-500/40 text-bullion-400 shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                User Identity & Role Administration
              </h1>
              <span className="rounded bg-bullion-500/10 border border-bullion-500/30 text-bullion-700 dark:text-bullion-400 text-[9px] font-mono font-bold px-2 py-0.5">
                RBAC DIRECTORY
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Deterministic clearance levels, access delegation, and cryptographic PIN status.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchUsers(page, searchQuery, roleFilter);
              fetchBreakdown();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-vault-border bg-white dark:bg-vault-surface py-2 px-3 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 hover:border-bullion-500 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>

          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian px-3.5 py-2 text-xs font-mono font-bold hover:bg-slate-800 dark:hover:bg-bullion-400 transition shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Operations</span>
          </Link>
        </div>
      </div>

      {/* Institutional Clearance Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => handleRoleFilter("ALL")}
          className={`rounded-2xl border p-4 space-y-1 text-left transition shadow-xs ${
            roleFilter === "ALL"
              ? "border-bullion-500 ring-1 ring-bullion-500 bg-bullion-500/5 dark:bg-bullion-500/10"
              : "border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card hover:border-bullion-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>TOTAL DIRECTORY</span>
            <Users className="h-4 w-4 text-bullion-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {systemCounts.total}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Enrolled identity profiles
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleRoleFilter("admin")}
          className={`rounded-2xl border p-4 space-y-1 text-left transition shadow-xs ${
            roleFilter === "admin"
              ? "border-purple-500 ring-1 ring-purple-500 bg-purple-500/10"
              : "border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card hover:border-purple-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-purple-600 dark:text-purple-400 font-bold">
            <span>SUPER ADMINS</span>
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {systemCounts.admin}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Root clearance level
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleRoleFilter("auditor")}
          className={`rounded-2xl border p-4 space-y-1 text-left transition shadow-xs ${
            roleFilter === "auditor"
              ? "border-bullion-500 ring-1 ring-bullion-500 bg-bullion-500/10"
              : "border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card hover:border-bullion-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-bullion-700 dark:text-bullion-400 font-bold">
            <span>AUDIT INSPECTORS</span>
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {systemCounts.auditor}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Read-only global ledger
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleRoleFilter("teller")}
          className={`rounded-2xl border p-4 space-y-1 text-left transition shadow-xs ${
            roleFilter === "teller"
              ? "border-cyan-500 ring-1 ring-cyan-500 bg-cyan-500/10"
              : "border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card hover:border-cyan-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">
            <span>TELLERS</span>
            <Banknote className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {systemCounts.teller}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Desk OTC operations
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleRoleFilter("user")}
          className={`rounded-2xl border p-4 space-y-1 text-left transition shadow-xs ${
            roleFilter === "user"
              ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-500/10"
              : "border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-emerald-600 dark:text-ledger-credit font-bold">
            <span>CUSTOMERS</span>
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {systemCounts.user}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Personal retail banking
          </div>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search users by name, username, or email..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-vault-border bg-slate-50 dark:bg-vault-surface text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-bullion-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {(searchQuery !== "" || roleFilter !== "ALL") && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-slate-100 dark:bg-vault-surface text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-vault-border transition shadow-xs self-start md:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Active Filter Tags */}
        {(searchQuery !== "" || roleFilter !== "ALL") && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 px-1">
            <span>Active filters:</span>
            {roleFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bullion-500/10 border border-bullion-500/30 text-bullion-700 dark:text-bullion-400">
                Role: {roleFilter.toUpperCase()}
                <button type="button" onClick={() => setRoleFilter("ALL")} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bullion-500/10 border border-bullion-500/30 text-bullion-700 dark:text-bullion-400">
                Query: &quot;{searchQuery}&quot;
                <button type="button" onClick={() => setSearchQuery("")} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold underline text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white ml-1"
            >
              Reset All
            </button>
            <span className="text-slate-400">({total} matching)</span>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-[#E2DDD0] dark:border-vault-border bg-white dark:bg-vault-card shadow-xs dark:shadow-milled overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-vault-surface/60 border-b border-[#E2DDD0] dark:border-vault-border text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">User Identity</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Clearance Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4 text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-vault-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400 font-mono">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-bullion-500" />
                    Querying institutional user directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400 font-mono">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        No users match active search criteria.
                      </p>
                      <p className="text-xs text-slate-400">
                        Try adjusting keywords or clearing clearance filter constraints.
                      </p>
                      {(searchQuery || roleFilter !== "ALL") && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian font-bold transition hover:opacity-90"
                        >
                          <X className="w-3.5 h-3.5" />
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-vault-surface/40 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-vault-surface border border-bullion-500/40 text-bullion-400 flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                            {u.first_name?.[0] || u.username?.[0] || "U"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {u.first_name} {u.last_name}
                              {isSelf && (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-bullion-500/10 border border-bullion-500/30 text-bullion-700 dark:text-bullion-400 uppercase">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {u.email}
                      </td>
                      <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-mono font-bold ${
                            u.status === "ACTIVE"
                              ? "text-emerald-600 dark:text-ledger-credit"
                              : u.status === "SUSPENDED"
                              ? "text-amber-500"
                              : "text-rose-500"
                          }`}
                        >
                          ● {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openRoleModal(u)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-100 dark:bg-vault-surface border border-slate-200 dark:border-vault-border text-slate-800 dark:text-slate-200 hover:border-bullion-500 dark:hover:border-bullion-500/60 hover:text-bullion-600 dark:hover:text-bullion-400 transition shadow-xs"
                        >
                          <Edit2 className="w-3 h-3" /> Change Role
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2DDD0] dark:border-vault-border text-xs font-mono">
          <span className="text-slate-500 dark:text-slate-400">
            {total === 0
              ? "No users"
              : `Showing ${rangeStart}–${rangeEnd} of ${total} users`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0 || loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-vault-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-vault-surface text-slate-700 dark:text-slate-300 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-3 py-1 text-slate-500 dark:text-slate-400">
              Page {page + 1} of {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page + 1 >= totalPages || loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-vault-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-vault-surface text-slate-700 dark:text-slate-300 transition"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Role Assignment Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl rounded-3xl border border-slate-200/90 dark:border-vault-border bg-white dark:bg-vault-card p-6 sm:p-7 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-vault-border pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="h-5 w-5 text-bullion-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                    Modify Institutional Clearance Level
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Target: @{selectedUser.username} ({selectedUser.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-vault-surface transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Self Demotion Warning */}
            {selectedUser.id === currentUser?.id && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <span className="font-bold">Active Authenticated Session:</span> You cannot
                  demote your own Administrator role to prevent lockout.
                </div>
              </div>
            )}

            {/* Role Options */}
            <div className="space-y-2.5 font-mono">
              {roleOptions.map((opt) => {
                const isSelected = targetRole === opt.role;
                const Icon = opt.icon;
                const isSelf = selectedUser.id === currentUser?.id;
                const isDisabled = isSelf && opt.role !== "admin";

                return (
                  <button
                    key={opt.role}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setTargetRole(opt.role)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3.5 shadow-xs ${
                      isDisabled
                        ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-vault-surface/40 border-slate-200 dark:border-vault-border"
                        : isSelected
                        ? "bg-bullion-500/10 border-bullion-500 ring-1 ring-bullion-500 text-slate-900 dark:text-white"
                        : "bg-slate-50/70 dark:bg-vault-surface/40 border-slate-200/80 dark:border-vault-border hover:border-bullion-500/50 hover:bg-white dark:hover:bg-vault-surface"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isSelected
                          ? "bg-bullion-500 text-slate-950 font-bold"
                          : "bg-slate-200 dark:bg-vault-surface text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs font-mono text-slate-900 dark:text-white uppercase tracking-wide">
                          {opt.title}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-bullion-500 dark:text-bullion-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-mono">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 font-mono">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-vault-surface transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating || targetRole === selectedUser.role}
                onClick={handleUpdateRole}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-bold bg-slate-900 dark:bg-bullion-500 text-white dark:text-vault-obsidian hover:bg-slate-800 dark:hover:bg-bullion-400 transition shadow-xs disabled:opacity-50"
              >
                {updating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Updating...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" /> Save Clearance
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
