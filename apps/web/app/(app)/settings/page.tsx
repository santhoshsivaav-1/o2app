"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

interface Gender {
  id: string;
  name: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const { has } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);

  const genders = useQuery({
    queryKey: ["genders-all"],
    queryFn: () => apiFetch<Gender[]>("/genders?includeInactive=true"),
    enabled: has("settings.manage"),
  });

  function done(okMsg: string) {
    setMsgOk(true);
    setMsg(okMsg);
    setName("");
    queryClient.invalidateQueries({ queryKey: ["genders-all"] });
    queryClient.invalidateQueries({ queryKey: ["genders"] });
  }
  function fail(e: unknown) {
    setMsgOk(false);
    setMsg(e instanceof ApiError ? e.message : "Save failed");
  }

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/genders", { method: "POST", body: JSON.stringify({ name: name.trim() }) }),
    onSuccess: () => done("Category added."),
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (g: Gender) =>
      apiFetch(`/genders/${g.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !g.isActive }),
      }),
    onSuccess: () => done("Category updated."),
    onError: fail,
  });

  if (!has("settings.manage"))
    return (
      <div>
        <h1 className="page-title">Settings</h1>
        <div className="card mt-4">
          <p className="font-medium text-stone-900">Not permitted</p>
          <p className="mt-1 text-sm text-stone-500">Gym settings are managed by the owner.</p>
        </div>
      </div>
    );

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">
          Gym-wide configuration. Changes apply to new records immediately.
        </p>
      </div>
      {msg && <p className={msgOk ? "alert-ok" : "alert-error"}>{msg}</p>}

      <div className="card">
        <h2 className="text-base font-semibold text-stone-900">Gender categories</h2>
        <p className="page-sub">
          Used in member registration. Categories with members can be deactivated, never deleted.
        </p>
        <ul className="mt-3 space-y-2">
          {genders.data?.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
            >
              <span className="font-medium text-stone-900">{g.name}</span>
              {g.isActive ? (
                <span className="badge-green">Active</span>
              ) : (
                <span className="badge">Inactive</span>
              )}
              <button
                className="btn-ghost ml-auto px-2.5 py-1 text-xs"
                onClick={() => toggle.mutate(g)}
                disabled={toggle.isPending}
              >
                {g.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </li>
          ))}
        </ul>
        {genders.isLoading && <p className="mt-2 text-sm text-stone-500">Loading…</p>}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category, e.g. Non-binary"
          />
          <button
            className="btn-primary shrink-0 text-sm"
            type="submit"
            disabled={create.isPending}
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
