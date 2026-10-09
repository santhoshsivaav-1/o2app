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
      <div>
        <h1 className="page-title">Roles & permissions</h1>
        <div className="card mt-4">
          <p className="font-medium text-stone-900">Not permitted</p>
          <p className="mt-1 text-sm text-stone-500">
            Your account lacks <code className="rounded bg-stone-100 px-1">roles.manage</code>.
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Roles & permissions</h1>
        <p className="page-sub">
          Templates that decide what each staff member can see and do. Backend-enforced on every
          request.
        </p>
      </div>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <div className="space-y-3">
        {roles.data?.map((r) => (
          <div key={r.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold capitalize text-stone-900">{r.name}</p>
              <span className="badge">{r.userCount} users</span>
              <span className="badge">{r.permissions.length} permissions</span>
              <button
                className="btn-ghost ml-auto px-2.5 py-1 text-xs"
                onClick={() => (editing === r.id ? setEditing(null) : startEdit(r))}
              >
                {editing === r.id ? "Cancel" : "Edit permissions"}
              </button>
            </div>
            {editing === r.id ? (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  {perms.data?.permissions.map((p) => (
                    <label
                      key={p}
                      className="badge cursor-pointer gap-1.5 !py-1.5 hover:border-brand-300"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-orange-600"
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
                  className="btn-primary mt-4"
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Saving…" : "Save permissions"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                {r.permissions.join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
      {roles.isLoading && <p className="text-sm text-stone-500">Loading roles…</p>}
    </div>
  );
}
