"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const change = useMutation({
    mutationFn: () =>
      apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      setOk(true);
      setMsg(
        "Password changed. Other sessions stay active — use “Sign out everywhere” to revoke them.",
      );
      setForm({ currentPassword: "", newPassword: "" });
    },
    onError: (e) => {
      setOk(false);
      setMsg(e instanceof ApiError ? e.message : "Change failed");
    },
  });

  const logoutAll = useMutation({
    mutationFn: () => apiFetch("/auth/logout-all", { method: "POST" }),
    onSuccess: () => logout(),
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="page-title">Profile</h1>
        <p className="page-sub">Your account and active sessions.</p>
      </div>

      <div className="card flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white"
        >
          {user?.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <div>
          <p className="font-semibold text-stone-900">{user?.name}</p>
          <p className="text-sm text-stone-500">{user?.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {user?.roles.map((r) => (
              <span key={r.id} className="badge">
                {r.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          change.mutate();
        }}
      >
        <h2 className="text-base font-semibold text-stone-900">Change password</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Current password</label>
            <input
              className="input"
              type="password"
              required
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              className="input"
              type="password"
              required
              minLength={10}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              placeholder="Min 10 chars, letters + numbers"
            />
          </div>
        </div>
        {msg && <p className={ok ? "alert-ok mt-4" : "alert-error mt-4"}>{msg}</p>}
        <button className="btn-primary mt-4" type="submit" disabled={change.isPending}>
          {change.isPending ? "Changing…" : "Change password"}
        </button>
      </form>

      <div className="card">
        <h2 className="text-base font-semibold text-stone-900">Sessions</h2>
        <p className="page-sub">Revoke every session for this account on all devices.</p>
        <button
          className="btn-danger mt-3"
          onClick={() => logoutAll.mutate()}
          disabled={logoutAll.isPending}
        >
          Sign out everywhere
        </button>
      </div>
    </div>
  );
}
