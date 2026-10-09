"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { packageSchema } from "@o2app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ApiError, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

const formSchema = packageSchema.omit({ isActive: true });
type FormValues = z.input<typeof formSchema>;

interface Pkg {
  id: string;
  name: string;
  description: string | null;
  durationValue: number;
  durationUnit: string;
  durationDays: number;
  price: string;
  registrationFee: string;
  discountMaxPct: string | null;
  gstPercent: string | null;
  isActive: boolean;
}

const err = "field-err";
const empty: FormValues = {
  name: "",
  description: "",
  durationValue: 1,
  durationUnit: "MONTH",
  price: 0,
  registrationFee: 0,
  eligibility: "",
};

function inr(n: string | number): string {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export default function PackagesPage() {
  const { has } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = has("settings.manage");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);

  const packages = useQuery({
    queryKey: ["packages", showInactive],
    queryFn: () => apiFetch<Pkg[]>(`/packages${showInactive ? "?includeInactive=true" : ""}`),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: empty });

  function startEdit(p: Pkg) {
    setEditing(p);
    setMsg(null);
    reset({
      name: p.name,
      description: p.description ?? "",
      durationValue: p.durationValue,
      durationUnit: p.durationUnit as "DAY" | "MONTH",
      price: Number(p.price),
      registrationFee: Number(p.registrationFee),
      discountMaxPct: p.discountMaxPct !== null ? Number(p.discountMaxPct) : undefined,
      gstPercent: p.gstPercent !== null ? Number(p.gstPercent) : undefined,
      eligibility: "",
    });
  }

  function startCreate() {
    setEditing(null);
    setMsg(null);
    reset(empty);
  }

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      editing
        ? apiFetch(`/packages/${editing.id}`, { method: "PATCH", body: JSON.stringify(values) })
        : apiFetch("/packages", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => {
      setMsgOk(true);
      setMsg(editing ? "Package updated." : "Package created.");
      setEditing(null);
      reset(empty);
      queryClient.invalidateQueries({ queryKey: ["packages"] });
    },
    onError: (e) => {
      setMsgOk(false);
      setMsg(e instanceof ApiError ? e.message : "Save failed");
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => apiFetch(`/packages/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packages"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">Membership packages</h1>
          <p className="page-sub">What the front desk can sell — durations, pricing and GST.</p>
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-orange-600"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {packages.isLoading && <p className="text-sm text-stone-500">Loading packages…</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {packages.data?.map((p: Pkg) => (
          <div key={p.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-stone-900">{p.name}</p>
              {p.isActive ? (
                <span className="badge-green">Active</span>
              ) : (
                <span className="badge">Inactive</span>
              )}
              {canWrite && (
                <span className="ml-auto flex gap-2">
                  <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  {p.isActive && (
                    <button
                      className="btn-danger px-2.5 py-1 text-xs"
                      onClick={() => deactivate.mutate(p.id)}
                    >
                      Deactivate
                    </button>
                  )}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-2xl font-bold tracking-tight text-stone-900">{inr(p.price)}</p>
              <p className="text-xs text-stone-500">
                {p.durationValue} {p.durationUnit === "MONTH" ? "month(s)" : "day(s)"} ·{" "}
                {p.durationDays} days
              </p>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3 text-xs">
              <div>
                <dt className="text-stone-400">Reg. fee</dt>
                <dd className="mt-0.5 font-medium text-stone-800">{inr(p.registrationFee)}</dd>
              </div>
              <div>
                <dt className="text-stone-400">GST</dt>
                <dd className="mt-0.5 font-medium text-stone-800">
                  {p.gstPercent !== null ? `${p.gstPercent}%` : "Gym default"}
                </dd>
              </div>
              <div>
                <dt className="text-stone-400">Max discount</dt>
                <dd className="mt-0.5 font-medium text-stone-800">
                  {p.discountMaxPct !== null ? `${p.discountMaxPct}%` : "—"}
                </dd>
              </div>
            </dl>
            {p.description && <p className="mt-3 text-sm text-stone-600">{p.description}</p>}
          </div>
        ))}
      </div>
      {packages.data?.length === 0 && (
        <div className="card text-center">
          <p className="font-medium text-stone-900">No packages yet</p>
          <p className="mt-1 text-sm text-stone-500">
            Create the first package below to start selling memberships.
          </p>
        </div>
      )}

      {canWrite ? (
        <form className="card max-w-3xl" onSubmit={handleSubmit((v) => save.mutate(v))}>
          <h2 className="text-base font-semibold text-stone-900">
            {editing ? `Edit ${editing.name}` : "New package"}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name *</label>
              <input
                className="input"
                {...register("name")}
                placeholder="Quarterly Transformation"
              />
              {errors.name && <p className={err}>{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Duration *</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  {...register("durationValue", { valueAsNumber: true })}
                />
                {errors.durationValue && <p className={err}>{errors.durationValue.message}</p>}
              </div>
              <div>
                <label className="label">Unit *</label>
                <select className="input" {...register("durationUnit")}>
                  <option value="MONTH">Month(s)</option>
                  <option value="DAY">Day(s)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Price (₹) *</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                {...register("price", { valueAsNumber: true })}
              />
              {errors.price && <p className={err}>{errors.price.message}</p>}
            </div>
            <div>
              <label className="label">Registration fee (₹)</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                {...register("registrationFee", { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="label">GST %</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                step="0.01"
                {...register("gstPercent", { valueAsNumber: true })}
              />
              <p className="hint">Blank = gym default.</p>
            </div>
            <div>
              <label className="label">Max discount %</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                step="0.01"
                {...register("discountMaxPct", { valueAsNumber: true })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={2} {...register("description")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Eligibility notes</label>
              <input
                className="input"
                {...register("eligibility")}
                placeholder="e.g. Couples only"
              />
            </div>
          </div>
          {msg && <p className={msgOk ? "alert-ok mt-4" : "alert-error mt-4"}>{msg}</p>}
          <div className="mt-4 flex gap-2 border-t border-stone-100 pt-4">
            <button className="btn-primary" type="submit" disabled={isSubmitting || save.isPending}>
              {editing ? "Save changes" : "Create package"}
            </button>
            {editing && (
              <button type="button" className="btn-ghost" onClick={startCreate}>
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className="text-sm text-stone-500">
          Package changes require the owner — your account can browse but not edit.
        </p>
      )}
    </div>
  );
}
