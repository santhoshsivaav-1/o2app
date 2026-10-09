"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

interface RoleRow {
  id: string;
  name: string;
  userCount: number;
  permissions: string[];
}

export default function RolesPage() {
  const { has } = useAuth();
  const queryClient = useQueryClient();
  const perms = useQuery({
    queryKey: ["permissions"],
    queryFn: () => apiFetch<{ permissions: string[] }>("/permissions"),
    enabled: has("roles.manage"),
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleRow[]>("/roles"),
    enabled: has("roles.manage"),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function startEdit(r: RoleRow) {
    setEditing(r.id);
    setChecked(r.permissions);
    setError(null);
  }

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/roles/${editing}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissionKeys: checked }),
      }),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed"),
  });

  if (!has("roles.manage"))
    return (
      <div className="card">
        <h1 className="text-lg font-semibold">Not permitted</h1>
        <p className="mt-1 text-sm text-stone-400">
          Your account lacks <code>roles.manage</code>.
        </p>
      </div>
    );

  return (
    <div className="card space-y-4">
      <h1 className="text-lg font-semibold">Roles & permissions</h1>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {roles.data?.map((r) => (
        <div key={r.id} className="rounded-lg border border-stone-800 p-4">
          <div className="flex items-center gap-3">
            <p className="font-medium">{r.name}</p>
            <span className="badge">{r.userCount} users</span>
            <span className="badge">{r.permissions.length} permissions</span>
            <button
              className="btn-ghost ml-auto px-2 py-1 text-xs"
              onClick={() => (editing === r.id ? setEditing(null) : startEdit(r))}
            >
              {editing === r.id ? "Cancel" : "Edit"}
            </button>
          </div>
          {editing === r.id ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {perms.data?.permissions.map((p) => (
                  <label key={p} className="badge cursor-pointer gap-1">
                    <input
                      type="checkbox"
                      className="accent-orange-500"
                      checked={checked.includes(p)}
                      onChange={(e) =>
                        setChecked(
                          e.target.checked ? [...checked, p] : checked.filter((x) => x !== p),
                        )
                      }
                    />
                    {p}
                  </label>
                ))}
              </div>
              <button
                className="btn-primary"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Saving…" : "Save permissions"}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-stone-500">{r.permissions.join(", ")}</p>
          )}
        </div>
      ))}
      {roles.isLoading && <p className="text-sm text-stone-500">Loading…</p>}
    </div>
  );
}
