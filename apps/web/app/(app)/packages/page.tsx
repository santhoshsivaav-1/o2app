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

const err = "mt-1 text-xs text-red-300";
const empty: FormValues = {
  name: "",
  description: "",
  durationValue: 1,
  durationUnit: "MONTH",
  price: 0,
  registrationFee: 0,
  eligibility: "",
};

export default function PackagesPage() {
  const { has } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = has("settings.manage");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
      setMsg(editing ? "Package updated." : "Package created.");
      setEditing(null);
      reset(empty);
      queryClient.invalidateQueries({ queryKey: ["packages"] });
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : "Save failed"),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => apiFetch(`/packages/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packages"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Membership packages</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-stone-400">
          <input
            type="checkbox"
            className="accent-orange-500"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {packages.data?.map((p: Pkg) => (
          <div key={p.id} className="card">
            <div className="flex items-center gap-2">
              <p className="font-medium">{p.name}</p>
              <span className="badge">{p.isActive ? "active" : "inactive"}</span>
              <span className="badge">
                {p.durationValue} {p.durationUnit === "MONTH" ? "month(s)" : "day(s)"} ·{" "}
                {p.durationDays} days
              </span>
              {canWrite && (
                <span className="ml-auto flex gap-2">
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  {p.isActive && (
                    <button
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => deactivate.mutate(p.id)}
                    >
                      Deactivate
                    </button>
                  )}
                </span>
              )}
            </div>
            <p className="mt-2 text-xl font-semibold text-brand-300">
              ₹{Number(p.price).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Reg. fee ₹{Number(p.registrationFee).toLocaleString("en-IN")}
              {p.gstPercent !== null ? ` · GST ${p.gstPercent}%` : " · GST default"}
              {p.discountMaxPct !== null ? ` · max discount ${p.discountMaxPct}%` : ""}
            </p>
            {p.description && <p className="mt-2 text-sm text-stone-400">{p.description}</p>}
          </div>
        ))}
      </div>
      {packages.data?.length === 0 && (
        <p className="text-sm text-stone-500">No packages yet — create the first one below.</p>
      )}

      {canWrite ? (
        <form
          className="card grid max-w-2xl gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((v) => save.mutate(v))}
        >
          <h2 className="font-medium sm:col-span-2">
            {editing ? `Edit ${editing.name}` : "New package"}
          </h2>
          <div>
            <label className="label">Name *</label>
            <input className="input" {...register("name")} />
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
            <label className="label">GST % (blank = gym default)</label>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              step="0.01"
              {...register("gstPercent", { valueAsNumber: true })}
            />
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
            <input className="input" {...register("eligibility")} />
          </div>
          {msg && <p className="text-sm text-stone-300 sm:col-span-2">{msg}</p>}
          <div className="flex gap-2 sm:col-span-2">
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
          Package changes require the owner (settings.manage permission).
        </p>
      )}
    </div>
  );
}
