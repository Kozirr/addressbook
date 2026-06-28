"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type UserStatus = "pending_email" | "pending_recovery" | "active";

export interface AuthUser {
  id: string;
  email: string;
  encryptionSalt: string;
  recoverySalt?: string;
  status: UserStatus;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  register: (email: string, password: string, confirmPassword: string) => Promise<{ user: AuthUser; redirectTo: string }>;
  login: (email: string, password: string) => Promise<{ user: AuthUser; redirectTo: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const register = async (
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<{ user: AuthUser; redirectTo: string }> => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirmPassword }),
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    setUser(data.user);
    return { user: data.user, redirectTo: data.redirectTo ?? "/confirm-email" };
  };

  const login = async (email: string, password: string): Promise<{ user: AuthUser; redirectTo: string }> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setUser(data.user);
    return { user: data.user, redirectTo: data.redirectTo ?? "/" };
  };

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, register, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
