"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () =>
      apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      setMsg(
        "Password changed. Other sessions stay active; use Sign out everywhere to revoke them.",
      );
      setForm({ currentPassword: "", newPassword: "" });
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : "Change failed"),
  });

  const logoutAll = useMutation({
    mutationFn: () => apiFetch("/auth/logout-all", { method: "POST" }),
    onSuccess: () => logout(),
  });

  return (
    <div className="max-w-lg space-y-5">
      <div className="card">
        <h1 className="text-lg font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-stone-400">
          {user?.name} · {user?.email}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {user?.roles.map((r) => (
            <span key={r.id} className="badge">
              {r.name}
            </span>
          ))}
        </div>
      </div>
      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          change.mutate();
        }}
      >
        <h2 className="font-medium">Change password</h2>
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
          <label className="label">New password (min 10 chars, letters + numbers)</label>
          <input
            className="input"
            type="password"
            required
            minLength={10}
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          />
        </div>
        {msg && <p className="text-sm text-stone-300">{msg}</p>}
        <button className="btn-primary" type="submit" disabled={change.isPending}>
          {change.isPending ? "Changing…" : "Change password"}
        </button>
      </form>
      <div className="card">
        <h2 className="font-medium">Sessions</h2>
        <p className="mt-1 text-sm text-stone-400">
          Revoke every session for this account on all devices.
        </p>
        <button
          className="btn-ghost mt-3"
          onClick={() => logoutAll.mutate()}
          disabled={logoutAll.isPending}
        >
          Sign out everywhere
        </button>
      </div>
    </div>
  );
}
