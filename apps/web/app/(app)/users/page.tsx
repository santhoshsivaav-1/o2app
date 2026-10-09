"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

interface StaffUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: { id: string; name: string }[];
}

interface Role {
  id: string;
  name: string;
}

function Gate({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { has } = useAuth();
  if (!has(perm))
    return (
      <div>
        <h1 className="page-title">Staff accounts</h1>
        <div className="card mt-4">
          <p className="font-medium text-stone-900">Not permitted</p>
          <p className="mt-1 text-sm text-stone-500">
            Your account lacks the <code className="rounded bg-stone-100 px-1">{perm}</code>{" "}
            permission. Contact the owner.
          </p>
        </div>
      </div>
    );
  return <>{children}</>;
}

export default function UsersPage() {
  return (
    <Gate perm="staff.manage">
      <StaffManager />
    </Gate>
  );
}

function StaffManager() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => apiFetch<StaffUser[]>("/users") });
  const roles = useQuery({
    queryKey: ["roles-lite"],
    queryFn: () => apiFetch<{ id: string; name: string; permissions: string[] }[]>("/roles"),
  });
  const [form, setForm] = useState({ name: "", email: "", password: "", roleIds: [] as string[] });
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const create = useMutation({
    mutationFn: () => apiFetch("/users", { method: "POST", body: JSON.stringify({ ...form }) }),
    onSuccess: () => {
      setForm({ name: "", email: "", password: "", roleIds: [] });
      setError(null);
      invalidate();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Create failed"),
  });

  const toggle = useMutation({
    mutationFn: (u: StaffUser) =>
      apiFetch(`/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Update failed"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Staff accounts</h1>
        <p className="page-sub">
          Everyone who can sign in to this console, and their roles. Every account needs at least
          one role — otherwise its sidebar stays empty.
        </p>
      </div>

      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-stone-900">{u.name}</td>
                <td className="text-stone-500">{u.email}</td>
                <td>
                  {u.roles.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r.id} className="badge">
                          {r.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="badge-red">No roles — sidebar hidden</span>
                  )}
                </td>
                <td>
                  {u.isActive ? (
                    <span className="badge-green">Active</span>
                  ) : (
                    <span className="badge">Disabled</span>
                  )}
                </td>
                <td className="whitespace-nowrap text-right">
                  <button
                    className="btn-ghost px-2.5 py-1 text-xs"
                    onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                  >
                    {editingId === u.id ? "Close" : "Edit"}
                  </button>{" "}
                  <button
                    className="btn-ghost px-2.5 py-1 text-xs"
                    onClick={() => toggle.mutate(u)}
                  >
                    {u.isActive ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.isLoading && <p className="p-4 text-sm text-stone-500">Loading staff…</p>}
      </div>

      {editingId && (
        <EditUser
          key={editingId}
          user={users.data?.find((u) => u.id === editingId) ?? null}
          roles={roles.data ?? []}
          onDone={() => {
            setEditingId(null);
            invalidate();
          }}
          onError={setError}
        />
      )}

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.roleIds.length === 0) {
            setError("Pick at least one role — otherwise the new account sees an empty sidebar.");
            return;
          }
          create.mutate();
        }}
      >
        <h2 className="text-base font-semibold text-stone-900">Add staff member</h2>
        <p className="page-sub">They sign in with this email and temporary password.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Priya Sharma"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="priya@o2.fit"
            />
          </div>
          <div>
            <label className="label">Temporary password</label>
            <input
              className="input"
              type="password"
              required
              minLength={10}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 10 chars, letters + numbers"
            />
          </div>
          <fieldset>
            <legend className="label">Roles *</legend>
            <div className="flex flex-wrap gap-2 pt-1">
              {roles.data?.map((r: Role) => (
                <label
                  key={r.id}
                  className="badge cursor-pointer gap-1.5 !py-1.5 hover:border-brand-300"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-orange-600"
                    checked={form.roleIds.includes(r.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        roleIds: e.target.checked
                          ? [...form.roleIds, r.id]
                          : form.roleIds.filter((id) => id !== r.id),
                      })
                    }
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <button className="btn-primary mt-4" type="submit" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add staff"}
        </button>
      </form>
    </div>
  );
}

function EditUser({
  user,
  roles,
  onDone,
  onError,
}: {
  user: StaffUser | null;
  roles: Role[];
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(user?.roles.map((r) => r.id) ?? []);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!user) return null;

  async function save() {
    if (roleIds.length === 0) {
      onError("A user must keep at least one role.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/users/${user!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, roleIds }),
      });
      setMsg("Saved.");
      onDone();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (newPassword.length < 10) {
      onError("New password must be at least 10 characters.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/auth/users/${user!.id}/admin-reset`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      setMsg("Password reset — all sessions for this account were revoked.");
      setNewPassword("");
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="text-base font-semibold text-stone-900">
        Edit {user.name} <span className="font-normal text-stone-500">· {user.email}</span>
      </h2>
      {msg && <p className="alert-ok mt-3">{msg}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <fieldset>
          <legend className="label">Roles *</legend>
          <div className="flex flex-wrap gap-2 pt-1">
            {roles.map((r) => (
              <label
                key={r.id}
                className="badge cursor-pointer gap-1.5 !py-1.5 hover:border-brand-300"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-orange-600"
                  checked={roleIds.includes(r.id)}
                  onChange={(e) =>
                    setRoleIds(
                      e.target.checked ? [...roleIds, r.id] : roleIds.filter((id) => id !== r.id),
                    )
                  }
                />
                {r.name}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <button className="btn-primary mt-4 text-sm" onClick={save} disabled={busy}>
        Save changes
      </button>

      <div className="mt-5 border-t border-stone-100 pt-4">
        <h3 className="text-sm font-semibold text-stone-900">Reset password</h3>
        <p className="page-sub">Sets a new temporary password and signs them out everywhere.</p>
        <div className="mt-2 flex max-w-md gap-2">
          <input
            className="input"
            type="password"
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New temporary password"
          />
          <button className="btn-danger shrink-0 text-sm" onClick={resetPassword} disabled={busy}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
