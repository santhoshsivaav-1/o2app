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

  const create = useMutation({
    mutationFn: () => apiFetch("/users", { method: "POST", body: JSON.stringify({ ...form }) }),
    onSuccess: () => {
      setForm({ name: "", email: "", password: "", roleIds: [] });
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Create failed"),
  });

  const toggle = useMutation({
    mutationFn: (u: StaffUser) =>
      apiFetch(`/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Update failed"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Staff accounts</h1>
        <p className="page-sub">Everyone who can sign in to this console, and their roles.</p>
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
                  <span className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r.id} className="badge">
                        {r.name}
                      </span>
                    ))}
                  </span>
                </td>
                <td>
                  {u.isActive ? (
                    <span className="badge-green">Active</span>
                  ) : (
                    <span className="badge">Disabled</span>
                  )}
                </td>
                <td className="text-right">
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

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
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
            <legend className="label">Roles</legend>
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
