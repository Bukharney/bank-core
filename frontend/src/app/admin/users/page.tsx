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
  ChevronRight,
  UserCheck,
} from "lucide-react";

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>("user");
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.admin.listUsers(100, 0);
      if (res.data) {
        setUsers(res.data.users);
        setTotal(res.data.total);
      } else if (res.error) {
        showToast(res.error, "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to load user directory", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const roleCounts = {
    total: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    auditor: users.filter((u) => u.role === "auditor").length,
    teller: users.filter((u) => u.role === "teller").length,
    user: users.filter((u) => u.role === "user" || !u.role).length,
  };

  const getRoleBadge = (role: UserRole | string) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/25">
            <ShieldAlert className="w-3 h-3" /> ADMIN
          </span>
        );
      case "auditor":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <ShieldCheck className="w-3 h-3" /> AUDITOR
          </span>
        );
      case "teller":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
            <Banknote className="w-3 h-3" /> TELLER
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
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
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
            <Link href="/admin" className="hover:text-foreground transition-colors">
              Core Operations
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary font-semibold">User Directory</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" />
            User Identity & Role Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage system clearance levels and enforce Role-Based Access Control (RBAC).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Role Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <button
          onClick={() => setRoleFilter("ALL")}
          className={`p-4 rounded-xl border text-left transition-all ${
            roleFilter === "ALL"
              ? "bg-card border-primary ring-1 ring-primary shadow-sm"
              : "bg-card/60 border-border hover:border-border/80"
          }`}
        >
          <span className="text-xs font-medium text-muted-foreground uppercase">Total Users</span>
          <p className="text-2xl font-bold text-foreground mt-1">{roleCounts.total}</p>
        </button>

        <button
          onClick={() => setRoleFilter("admin")}
          className={`p-4 rounded-xl border text-left transition-all ${
            roleFilter === "admin"
              ? "bg-purple-500/10 border-purple-500 ring-1 ring-purple-500 shadow-sm"
              : "bg-card/60 border-border hover:border-purple-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-400 uppercase">Admins</span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-300 mt-1">{roleCounts.admin}</p>
        </button>

        <button
          onClick={() => setRoleFilter("auditor")}
          className={`p-4 rounded-xl border text-left transition-all ${
            roleFilter === "auditor"
              ? "bg-amber-500/10 border-amber-500 ring-1 ring-amber-500 shadow-sm"
              : "bg-card/60 border-border hover:border-amber-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400 uppercase">Auditors</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 mt-1">{roleCounts.auditor}</p>
        </button>

        <button
          onClick={() => setRoleFilter("teller")}
          className={`p-4 rounded-xl border text-left transition-all ${
            roleFilter === "teller"
              ? "bg-cyan-500/10 border-cyan-500 ring-1 ring-cyan-500 shadow-sm"
              : "bg-card/60 border-border hover:border-cyan-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-cyan-400 uppercase">Tellers</span>
            <Banknote className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-cyan-300 mt-1">{roleCounts.teller}</p>
        </button>

        <button
          onClick={() => setRoleFilter("user")}
          className={`p-4 rounded-xl border text-left transition-all ${
            roleFilter === "user"
              ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500 shadow-sm"
              : "bg-card/60 border-border hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400 uppercase">Customers</span>
            <UserIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{roleCounts.user}</p>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border/60 text-xs font-mono uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">User Identity</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Access Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Registered</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading user records...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary uppercase">
                            {u.first_name?.[0] || u.username?.[0] || "U"}
                          </div>
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-1.5">
                              {u.first_name} {u.last_name}
                              {isSelf && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/20 text-primary uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-5 py-3.5">{getRoleBadge(u.role)}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-xs font-mono font-medium ${
                            u.status === "ACTIVE"
                              ? "text-emerald-400"
                              : u.status === "SUSPENDED"
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground font-mono">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => openRoleModal(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all shadow-sm"
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
      </div>

      {/* Role Assignment Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" /> Modify Clearance Level
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update role for{" "}
                  <span className="font-semibold text-foreground font-mono">
                    @{selectedUser.username}
                  </span>{" "}
                  ({selectedUser.email})
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Self Demotion Warning */}
            {selectedUser.id === currentUser?.id && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <span className="font-semibold">Current Authenticated Account:</span> You cannot
                  demote your own Administrator role to prevent locking yourself out.
                </div>
              </div>
            )}

            {/* Role Options */}
            <div className="space-y-2.5">
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
                    className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      isDisabled
                        ? "opacity-40 cursor-not-allowed bg-muted/20 border-border"
                        : isSelected
                        ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm"
                        : "bg-card hover:bg-muted/30 border-border"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground">
                          {opt.title}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating || targetRole === selectedUser.role}
                onClick={handleUpdateRole}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
              >
                {updating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Updating...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" /> Save Role
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
