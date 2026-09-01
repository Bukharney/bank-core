"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Account, User } from "@/lib/types";
import { api } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  accounts: Account[];
  activeAccount: Account | null;
  setActiveAccount: (account: Account | null) => void;
  loading: boolean;
  refreshData: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    username: string;
    email: string;
    phone_number?: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ["/login", "/register"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const router = useRouter();
  const pathname = usePathname();

  const refreshData = async () => {
    try {
      const userRes = await api.auth.me();
      if (userRes.data) {
        setUser(userRes.data);

        // Fetch user accounts
        const accRes = await api.accounts.list();
        if (accRes.data) {
          setAccounts(accRes.data);
          if (accRes.data.length > 0) {
            setActiveAccount((prev) => {
              if (prev) {
                const found = accRes.data?.find((a) => a.id === prev.id);
                return found || accRes.data![0];
              }
              return accRes.data![0];
            });
          }
        }
      } else {
        setUser(null);
        setAccounts([]);
        setActiveAccount(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user && !PUBLIC_ROUTES.includes(pathname)) {
        router.push("/login");
      } else if (user && PUBLIC_ROUTES.includes(pathname)) {
        router.push("/");
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    if (res.data) {
      await refreshData();
      router.push("/");
      return { success: true };
    }
    return { success: false, error: res.error || "Invalid credentials" };
  };

  const register = async (userData: {
    username: string;
    email: string;
    phone_number?: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => {
    const res = await api.auth.register(userData);
    if (res.data) {
      // Auto login after registration
      return await login(userData.email, userData.password);
    }
    return { success: false, error: res.error || "Registration failed" };
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    setAccounts([]);
    setActiveAccount(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accounts,
        activeAccount,
        setActiveAccount,
        loading,
        refreshData,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
