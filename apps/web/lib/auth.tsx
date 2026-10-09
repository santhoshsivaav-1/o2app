"use client";

import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ApiError, SessionUser, apiFetch } from "./api";

interface AuthCtx {
  user: SessionUser | null | undefined;
  isLoading: boolean;
  has: (perm: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginError: string | null;
}

const Ctx = createContext<AuthCtx | null>(null);

async function fetchMe(): Promise<SessionUser | null> {
  try {
    return await apiFetch<SessionUser>("/auth/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // Try one silent refresh (rotates the session), then re-read me.
      try {
        await apiFetch("/auth/refresh", { method: "POST" });
        return await apiFetch<SessionUser>("/auth/me");
      } catch {
        return null;
      }
    }
    throw e;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false, staleTime: 60_000 });

  const loginMut = useMutation<SessionUser, ApiError, { email: string; password: string }>({
    mutationFn: async ({ email, password }) => {
      const data = await apiFetch<{ user: SessionUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["me"], user);
      router.replace("/");
    },
  });

  const logoutMut = useMutation<unknown, ApiError, void>({
    mutationFn: () => apiFetch<unknown>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.setQueryData(["me"], null);
      router.replace("/login");
    },
  });

  const user = me.data ?? null;
  const value: AuthCtx = {
    user: me.isLoading ? undefined : user,
    isLoading: me.isLoading,
    has: (perm) => user?.permissions.includes(perm) ?? false,
    login: async (email, password) => {
      loginMut.reset();
      await loginMut.mutateAsync({ email, password });
    },
    logout: async () => {
      await logoutMut.mutateAsync();
    },
    loginError:
      loginMut.error instanceof ApiError
        ? loginMut.error.message
        : loginMut.error
          ? "Login failed — try again"
          : null,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
