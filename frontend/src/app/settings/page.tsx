"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatDate, formatAccountNumber, formatMoney } from "@/lib/currency";
import { getAccountMeta, COLOR_PRESETS } from "@/lib/accountMeta";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  Phone,
  Mail,
  AtSign,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  CreditCard,
  ArrowRight,
  Info,
  Key,
  ShieldAlert,
  Zap,
  Link2,
  Unlink,
  Smartphone,
} from "lucide-react";

export default function SettingsPage() {
  const { user, accounts, updateProfile, changePassword, setPin, loading, refreshData } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "pin" | "accounts">("profile");

  // Profile Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Security Form State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [securitySubmitting, setSecuritySubmitting] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState(false);

  // PIN Form State
  const [pinPassword, setPinPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPinPassword, setShowPinPassword] = useState(false);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  // Phone Linking State
  const [linkingAccountId, setLinkingAccountId] = useState<number | null>(null);
  const [phoneLinkSubmitting, setPhoneLinkSubmitting] = useState(false);
  const [phoneLinkError, setPhoneLinkError] = useState<string | null>(null);
  const [phoneLinkSuccess, setPhoneLinkSuccess] = useState<string | null>(null);


  // Populate initial profile values
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setPhoneNumber(user.phone_number || "");
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    if (!firstName.trim() || !lastName.trim()) {
      setProfileError("First name and Last name are required.");
      return;
    }

    setProfileSubmitting(true);
    try {
      const res = await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim() || undefined,
      });

      if (res.success) {
        setProfileSuccess(true);
        showToast("Profile details updated successfully!", "success");
        setTimeout(() => setProfileSuccess(false), 4000);
      } else {
        setProfileError(res.error || "Failed to update profile.");
        showToast(res.error || "Failed to update profile", "error");
      }
    } catch (err: any) {
      setProfileError(err.message || "An unexpected error occurred.");
      showToast("Error updating profile", "error");
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(false);

    if (!oldPassword) {
      setSecurityError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setSecurityError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityError("New password and confirmation do not match.");
      return;
    }

    setSecuritySubmitting(true);
    try {
      const res = await changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (res.success) {
        setSecuritySuccess(true);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        showToast("Password changed successfully!", "success");
        setTimeout(() => setSecuritySuccess(false), 4000);
      } else {
        setSecurityError(res.error || "Failed to change password.");
        showToast(res.error || "Failed to change password", "error");
      }
    } catch (err: any) {
      setSecurityError(err.message || "An unexpected error occurred.");
      showToast("Error changing password", "error");
    } finally {
      setSecuritySubmitting(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(false);

    if (!pinPassword) {
      setPinError("Please enter your account password to authorize PIN changes.");
      return;
    }

    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setPinError("Transaction PIN must be exactly 6 numeric digits (0-9).");
      return;
    }

    if (newPin !== confirmPin) {
      setPinError("New PIN and confirmation PIN do not match.");
      return;
    }

    setPinSubmitting(true);
    try {
      const res = await setPin({
        password: pinPassword,
        pin: newPin,
        confirm_pin: confirmPin,
      });

      if (res.success) {
        setPinSuccess(true);
        setPinPassword("");
        setNewPin("");
        setConfirmPin("");
        showToast("6-Digit Transaction PIN saved successfully!", "success");
        setTimeout(() => setPinSuccess(false), 4000);
      } else {
        setPinError(res.error || "Failed to save Transaction PIN.");
        showToast(res.error || "Failed to save PIN", "error");
      }
    } catch (err: any) {
      setPinError(err.message || "An unexpected error occurred.");
      showToast("Error saving Transaction PIN", "error");
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleLinkPhone = async (accountId: number) => {
    setLinkingAccountId(accountId);
    setPhoneLinkSubmitting(true);
    setPhoneLinkError(null);
    setPhoneLinkSuccess(null);
    try {
      await api.accounts.linkPhone(accountId);
      setPhoneLinkSuccess("Account connected to phone number successfully!");
      showToast("Phone deposit account linked!", "success");
      await refreshData();
    } catch (err: any) {
      setPhoneLinkError(err.message || "Failed to link account to phone number.");
      showToast(err.message || "Error linking account", "error");
    } finally {
      setPhoneLinkSubmitting(false);
      setLinkingAccountId(null);
    }
  };

  const handleUnlinkPhone = async (accountId: number) => {
    setLinkingAccountId(accountId);
    setPhoneLinkSubmitting(true);
    setPhoneLinkError(null);
    setPhoneLinkSuccess(null);
    try {
      await api.accounts.unlinkPhone(accountId);
      setPhoneLinkSuccess("Phone connection removed.");
      showToast("Phone link disconnected", "success");
      await refreshData();
    } catch (err: any) {
      setPhoneLinkError(err.message || "Failed to unlink account.");
      showToast(err.message || "Error unlinking account", "error");
    } finally {
      setPhoneLinkSubmitting(false);
      setLinkingAccountId(null);
    }
  };


  const isPasswordLengthValid = newPassword.length >= 8;
  const isPasswordMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isPinValidLength = newPin.length === 6 && /^\d{6}$/.test(newPin);
  const isPinMatch = newPin.length === 6 && newPin === confirmPin;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Banner / User Hero Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-8 shadow-sm">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-950 font-extrabold text-2xl shadow-md">
              {user.first_name?.[0]?.toUpperCase() || "U"}
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500" title="Account Active" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {user.first_name} {user.last_name}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-3 w-3" />
                  {user.status || "ACTIVE"}
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 uppercase text-[10px]">
                  {user.role || "USER"}
                </span>
                {user.has_pin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <Key className="h-3 w-3" />
                    PIN Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-3 w-3" />
                    PIN Not Set
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 font-mono">
                  <AtSign className="h-3 w-3" />
                  {user.username}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </span>
                {user.created_at && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Member since {formatDate(user.created_at)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <div className="w-full sm:w-auto rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 px-4 py-2.5 text-center sm:text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Accounts</div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {accounts.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Tabs + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Navigation Tabs */}
        <div className="space-y-2">
          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === "profile"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <UserIcon className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="leading-tight">Personal Details</div>
              <div className={`text-[10px] font-normal ${activeTab === "profile" ? "text-slate-300 dark:text-slate-600" : "text-slate-400"}`}>
                Name & contact
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === "security"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="leading-tight">Security & Password</div>
              <div className={`text-[10px] font-normal ${activeTab === "security" ? "text-slate-300 dark:text-slate-600" : "text-slate-400"}`}>
                Account login credentials
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("pin")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === "pin"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <KeyRound className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="leading-tight flex items-center gap-1.5">
                <span>Transaction PIN</span>
                {user.has_pin ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <div className={`text-[10px] font-normal ${activeTab === "pin" ? "text-slate-300 dark:text-slate-600" : "text-slate-400"}`}>
                6-digit transfer authorization
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("accounts")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === "accounts"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <CreditCard className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="leading-tight">Linked Accounts</div>
              <div className={`text-[10px] font-normal ${activeTab === "accounts" ? "text-slate-300 dark:text-slate-600" : "text-slate-400"}`}>
                {accounts.length} core account{accounts.length === 1 ? "" : "s"}
              </div>
            </div>
          </button>
        </div>

        {/* Right Content Panel */}
        <div className="lg:col-span-3">
          {/* TAB 1: Personal Details */}
          {activeTab === "profile" && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-blue-500" />
                  Personal Information
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Manage your personal name and contact phone number.
                </p>
              </div>

              {profileError && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{profileError}</div>
                </div>
              )}

              {profileSuccess && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>Your personal details have been updated successfully!</div>
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-6">
                {/* Read-Only Credentials Section */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 p-4 sm:p-5 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Verified System Identifiers (Read-Only)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                        Username
                      </label>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                        <AtSign className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{user.username}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                        Email Address
                      </label>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Editable Personal Details */}
                <div className="space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Editable Contact Details
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition"
                        placeholder="John"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Phone Number (Cardless ATM & Contact)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                        <Phone className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition"
                        placeholder="0812345678"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Used for ATM cardless withdrawal verification and notifications.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (user) {
                        setFirstName(user.first_name || "");
                        setLastName(user.last_name || "");
                        setPhoneNumber(user.phone_number || "");
                        setProfileError(null);
                      }
                    }}
                    className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Reset
                  </button>

                  <button
                    type="submit"
                    disabled={profileSubmitting}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-5 py-2.5 text-xs font-bold text-white dark:text-slate-900 hover:opacity-90 transition disabled:opacity-50 shadow-sm active:scale-95"
                  >
                    {profileSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Profile Details</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: Security & Password */}
          {activeTab === "security" && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-amber-500" />
                  Security & Password Credentials
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Change your account login password by verifying your current credentials.
                </p>
              </div>

              {securityError && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{securityError}</div>
                </div>
              )}

              {securitySuccess && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>Your password has been successfully updated!</div>
                </div>
              )}

              <form onSubmit={handleSecuritySubmit} className="space-y-5">
                {/* Current Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Current Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPass ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-10 pl-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass(!showOldPass)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showOldPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-10 pl-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition"
                      placeholder="Enter new password (min. 8 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-10 pl-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition"
                      placeholder="Repeat new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Criteria Checklist */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 p-4 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Password Requirements
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className={`flex items-center gap-2 ${isPasswordLengthValid ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400"}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 ${isPasswordLengthValid ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}`} />
                      <span>At least 8 characters long</span>
                    </div>
                    <div className={`flex items-center gap-2 ${isPasswordMatch ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400"}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 ${isPasswordMatch ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}`} />
                      <span>Passwords match</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={securitySubmitting || !isPasswordLengthValid || !isPasswordMatch}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-5 py-2.5 text-xs font-bold text-white dark:text-slate-900 hover:opacity-90 transition disabled:opacity-50 shadow-sm active:scale-95"
                  >
                    {securitySubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: Transaction PIN */}
          {activeTab === "pin" && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="h-5 w-5 text-emerald-500" />
                  6-Digit Transaction PIN
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure your 6-digit PIN required to authorize fund transfers and ATM withdrawals.
                </p>
              </div>

              {/* Status Banner */}
              {user.has_pin ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-bold">Transaction PIN is Active:</span> Your 6-digit PIN is currently protecting your transfers and ATM withdrawals. You can change your PIN anytime below by verifying your account password.
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-bold">Transaction PIN Not Configured:</span> You must create a 6-digit PIN before you can initiate money transfers or request cardless ATM withdrawals.
                  </div>
                </div>
              )}

              {pinError && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{pinError}</div>
                </div>
              )}

              {pinSuccess && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>Your 6-digit transaction PIN has been successfully updated and activated!</div>
                </div>
              )}

              <form onSubmit={handlePinSubmit} className="space-y-5">
                {/* Account Password Verification */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Account Login Password (Authorization) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPinPassword ? "text" : "password"}
                      value={pinPassword}
                      onChange={(e) => setPinPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-10 pl-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition"
                      placeholder="Enter account password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinPassword(!showPinPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPinPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Verifying your password ensures only you can set or reset your security PIN.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New 6-Digit PIN */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      New 6-Digit PIN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-mono tracking-widest text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition text-center"
                      placeholder="••••••"
                    />
                  </div>

                  {/* Confirm 6-Digit PIN */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Confirm 6-Digit PIN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-mono tracking-widest text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition text-center"
                      placeholder="••••••"
                    />
                  </div>
                </div>

                {/* PIN Criteria Checklist */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 p-4 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    PIN Requirements
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className={`flex items-center gap-2 ${isPinValidLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400"}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 ${isPinValidLength ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}`} />
                      <span>Exactly 6 numeric digits (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-2 ${isPinMatch ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400"}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 ${isPinMatch ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}`} />
                      <span>PINs match</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={pinSubmitting || !isPinValidLength || !isPinMatch || !pinPassword}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-5 py-2.5 text-xs font-bold text-white dark:text-slate-900 hover:opacity-90 transition disabled:opacity-50 shadow-sm active:scale-95"
                  >
                    {pinSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving PIN...</span>
                      </>
                    ) : (
                      <>
                        <Key className="h-3.5 w-3.5" />
                        <span>{user.has_pin ? "Update Transaction PIN" : "Activate Transaction PIN"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: Linked Accounts */}
          {activeTab === "accounts" && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-emerald-500" />
                    Linked Banking Accounts
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Manage core ledger accounts and designate your ATM / PromptPay phone deposit account.
                  </p>
                </div>

                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {phoneLinkError && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{phoneLinkError}</div>
                </div>
              )}

              {phoneLinkSuccess && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{phoneLinkSuccess}</div>
                </div>
              )}

              {/* PromptPay / Phone Deposit Connection Card */}
              <div className="rounded-2xl border border-indigo-200/70 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/40 dark:from-indigo-950/30 dark:via-slate-900/40 dark:to-slate-900/40 p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          PromptPay & ATM Deposit Link
                        </span>
                        <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5">
                          Instant Cash Routing
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                        Connect your mobile number to an account so anyone can deposit cash into your account at any ATM machine simply by typing your phone number.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {user.phone_number ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Registered Mobile</div>
                        <div className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mt-0.5">
                          <Smartphone className="h-3.5 w-3.5" />
                          {user.phone_number}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveTab("profile")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Add Phone in Profile</span>
                      </button>
                    )}
                  </div>
                </div>

                {user.phone_number && (
                  <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                    {(() => {
                      const linked = accounts.find((a) => a.linked_phone === user.phone_number);
                      if (linked) {
                        return (
                          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>
                              Active deposit account: <strong className="font-mono">{formatAccountNumber(linked.account_number)}</strong> ({linked.account_type})
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <Info className="h-4 w-4" />
                          <span>No account is currently connected to your phone number. Select one below to activate.</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Accounts List */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                  Your Accounts ({accounts.length})
                </div>

                {accounts.map((acc) => {
                  const meta = getAccountMeta(acc.id);
                  const colorPreset = COLOR_PRESETS[meta.color] || COLOR_PRESETS.slate;
                  const isPhoneLinked = acc.linked_phone && user.phone_number && acc.linked_phone === user.phone_number;
                  const isProcessing = linkingAccountId === acc.id && phoneLinkSubmitting;

                  return (
                    <div
                      key={acc.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 transition ${
                        isPhoneLinked
                          ? "border-emerald-300/80 dark:border-emerald-700/80 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm"
                          : "border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs ${colorPreset.badge}`}>
                          #{acc.id}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {meta.nickname || `${acc.account_type} Account`}
                            </span>
                            <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                              {acc.account_type}
                            </span>
                            {isPhoneLinked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                <Zap className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                                Phone Deposit Active
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatAccountNumber(acc.account_number)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-700/50">
                        <div className="text-right mr-2">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Balance</div>
                          <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {formatMoney(acc.balance, acc.currency)}
                          </div>
                        </div>

                        {/* Link / Unlink Action */}
                        {isPhoneLinked ? (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUnlinkPhone(acc.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition disabled:opacity-50"
                            title="Disconnect phone number from this account"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Unlink className="h-3.5 w-3.5" />
                            )}
                            <span>Unlink</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isProcessing || !user.phone_number}
                            onClick={() => handleLinkPhone(acc.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:border-indigo-200 dark:hover:bg-indigo-950/30 dark:hover:border-indigo-800 transition disabled:opacity-40"
                            title={
                              !user.phone_number
                                ? "Register a phone number in profile first"
                                : "Set this account to receive phone deposits"
                            }
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                            ) : (
                              <Link2 className="h-3.5 w-3.5 text-indigo-500" />
                            )}
                            <span>Connect Phone</span>
                          </button>
                        )}

                        <Link
                          href={`/ledger`}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition"
                          title="View Ledger Statement"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
