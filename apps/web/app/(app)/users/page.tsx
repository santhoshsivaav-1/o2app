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
      <div className="card">
        <h1 className="text-lg font-semibold">Not permitted</h1>
        <p className="mt-1 text-sm text-stone-400">
          Your account lacks the <code>{perm}</code> permission. Contact the owner.
        </p>
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
      <div className="card">
        <h1 className="text-lg font-semibold">Staff accounts</h1>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="text-stone-400">{u.email}</td>
                  <td>{u.roles.map((r) => r.name).join(", ")}</td>
                  <td>{u.isActive ? "active" : "disabled"}</td>
                  <td>
                    <button
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => toggle.mutate(u)}
                    >
                      {u.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.isLoading && <p className="py-4 text-sm text-stone-500">Loading…</p>}
        </div>
      </div>
      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <h2 className="font-medium">Add staff member</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            />
          </div>
          <div>
            <label className="label">Temporary password (min 10 chars, letters + numbers)</label>
            <input
              className="input"
              type="password"
              required
              minLength={10}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <fieldset>
            <legend className="label">Roles</legend>
            <div className="flex flex-wrap gap-2">
              {roles.data?.map((r: Role) => (
                <label key={r.id} className="badge cursor-pointer gap-1">
                  <input
                    type="checkbox"
                    className="accent-orange-500"
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
        <button className="btn-primary" type="submit" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add staff"}
        </button>
      </form>
    </div>
  );
}
