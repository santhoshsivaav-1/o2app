"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth";
import { ValidityBadge, dateOnly, inr } from "../../../../components/memberships";

interface Detail {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  validity: string;
  price: string;
  registrationFee: string;
  discountPct: string;
  discountAmount: string;
  gstPercent: string;
  gstAmount: string;
  total: string;
  notes: string | null;
  suspensionDays: number;
  cancelReason: string | null;
  member: { id: string; memberCode: string; fullName: string; mobile: string };
  package: {
    id: string;
    name: string;
    durationValue: number;
    durationUnit: string;
    isActive: boolean;
  };
  invoice: {
    invoiceNo: string;
    status: string;
    subtotal: string;
    discount: string;
    taxable: string;
    gst: string;
    total: string;
    items: { id: string; label: string; qty: number; unitPrice: string; amount: string }[];
  } | null;
  renewedFrom: { id: string; startDate: string; endDate: string } | null;
  renewedBy: { id: string; startDate: string; endDate: string }[];
  statusHistory: {
    id: string;
    from: string;
    to: string;
    reason: string | null;
    createdAt: string;
  }[];
}

export default function MembershipDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { has } = useAuth();
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewPkg, setRenewPkg] = useState("");
  const [renewStart, setRenewStart] = useState("");
  const [extendDays, setExtendDays] = useState(30);
  const [cancelReason, setCancelReason] = useState("");

  const detail = useQuery({
    queryKey: ["membership", id],
    queryFn: () => apiFetch<Detail>(`/memberships/${id}`),
  });
  const packages = useQuery({
    queryKey: ["packages-sale"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/packages"),
  });

  function refresh(okMsg: string) {
    setMsgOk(true);
    setMsg(okMsg);
    setRenewOpen(false);
    queryClient.invalidateQueries({ queryKey: ["membership", id] });
    queryClient.invalidateQueries({ queryKey: ["memberships"] });
  }
  function fail(e: unknown) {
    setMsgOk(false);
    setMsg(e instanceof ApiError ? e.message : "Action failed");
  }

  const renew = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/memberships/${id}/renew`, {
        method: "POST",
        body: JSON.stringify({
          packageId: renewPkg || undefined,
          startDate: renewStart || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    onSuccess: (d) => refresh(`Renewed — new membership ${d.id.slice(0, 8)}… created.`),
    onError: fail,
  });
  const extend = useMutation({
    mutationFn: () =>
      apiFetch(`/memberships/${id}/extend`, {
        method: "PATCH",
        body: JSON.stringify({ days: extendDays }),
      }),
    onSuccess: () => refresh(`Extended by ${extendDays} days.`),
    onError: fail,
  });
  const suspend = useMutation({
    mutationFn: () =>
      apiFetch(`/memberships/${id}/suspend`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => refresh("Membership suspended."),
    onError: fail,
  });
  const resume = useMutation({
    mutationFn: () => apiFetch(`/memberships/${id}/resume`, { method: "POST" }),
    onSuccess: () => refresh("Membership resumed — paused days added back."),
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () =>
      apiFetch(`/memberships/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason }),
      }),
    onSuccess: () => refresh("Membership cancelled."),
    onError: fail,
  });

  if (detail.isLoading) return <p className="text-sm text-stone-500">Loading membership…</p>;
  if (detail.error || !detail.data)
    return (
      <div className="card">
        <p className="alert-error">
          {detail.error instanceof ApiError ? detail.error.message : "Failed to load"}
        </p>
        <Link href="/memberships" className="btn-ghost mt-3 inline-flex text-sm">
          ← Memberships
        </Link>
      </div>
    );

  const m = detail.data;
  const canLifecycle = has("memberships.renew");

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href="/memberships"
          className="text-sm font-medium text-stone-500 hover:text-stone-800"
        >
          ← Memberships
        </Link>
        <h1 className="page-title">{m.member.fullName}</h1>
        <ValidityBadge validity={m.validity} />
        <span className="badge">{m.package.name}</span>
      </div>

      {msg && <p className={msgOk ? "alert-ok" : "alert-error"}>{msg}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card !p-4">
          <p className="section-title">Period</p>
          <p className="mt-1 text-sm font-medium tabular-nums text-stone-900">
            {dateOnly(m.startDate)} → {dateOnly(m.endDate)}
          </p>
        </div>
        <div className="card !p-4">
          <p className="section-title">Total</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-stone-900">{inr(m.total)}</p>
          <p className="text-xs text-stone-500">incl. {inr(m.gstAmount)} GST</p>
        </div>
        <div className="card !p-4">
          <p className="section-title">Invoice</p>
          <p className="mt-1 text-sm font-medium text-stone-900">{m.invoice?.invoiceNo ?? "—"}</p>
          <p className="text-xs text-stone-500">
            {m.invoice?.status === "unpaid"
              ? "Unpaid — payment recording arrives in Phase 5"
              : m.invoice?.status}
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-stone-900">Invoice {m.invoice?.invoiceNo}</h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {m.invoice?.items.map((it) => (
              <tr key={it.id}>
                <td>{it.label}</td>
                <td>{it.qty}</td>
                <td className="tabular-nums">{inr(it.unitPrice)}</td>
                <td className="text-right tabular-nums">{inr(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Subtotal</dt>
            <dd className="tabular-nums">{inr(m.invoice?.subtotal ?? 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Discount ({m.discountPct}%)</dt>
            <dd className="tabular-nums">− {inr(m.invoice?.discount ?? 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">GST ({m.gstPercent}%)</dt>
            <dd className="tabular-nums">+ {inr(m.invoice?.gst ?? 0)}</dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-1 font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{inr(m.invoice?.total ?? 0)}</dd>
          </div>
        </dl>
      </div>

      {canLifecycle && m.status !== "cancelled" && (
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-stone-900">Manage</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary text-sm" onClick={() => setRenewOpen(!renewOpen)}>
              Renew…
            </button>
            {m.status === "active" && (
              <button
                className="btn-ghost text-sm"
                onClick={() => suspend.mutate()}
                disabled={suspend.isPending}
              >
                Suspend
              </button>
            )}
            {m.status === "suspended" && (
              <button
                className="btn-ghost text-sm"
                onClick={() => resume.mutate()}
                disabled={resume.isPending}
              >
                Resume
              </button>
            )}
          </div>

          {renewOpen && (
            <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-3">
              <div>
                <label className="label">Package</label>
                <select
                  className="input"
                  value={renewPkg}
                  onChange={(e) => setRenewPkg(e.target.value)}
                >
                  <option value="">Keep {m.package.name}</option>
                  {packages.data
                    ?.filter((p) => p.id !== m.package.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="label">
                  Start (blank = continue after {dateOnly(m.endDate)})
                </label>
                <input
                  className="input"
                  type="date"
                  value={renewStart}
                  onChange={(e) => setRenewStart(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button
                  className="btn-primary text-sm"
                  onClick={() => renew.mutate()}
                  disabled={renew.isPending}
                >
                  {renew.isPending ? "Renewing…" : "Confirm renewal"}
                </button>
              </div>
            </div>
          )}

          {m.status === "active" && (
            <div className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-4">
              <div>
                <label className="label">Extend by (days)</label>
                <input
                  className="input w-28"
                  type="number"
                  min={1}
                  max={365}
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                />
              </div>
              <button
                className="btn-ghost text-sm"
                onClick={() => extend.mutate()}
                disabled={extend.isPending}
              >
                Extend
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-4">
            <div className="min-w-52 flex-1">
              <label className="label">Cancel reason (required)</label>
              <input
                className="input"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Moved to another city"
              />
            </div>
            <button
              className="btn-danger text-sm"
              disabled={!cancelReason.trim() || cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Cancel membership
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-base font-semibold text-stone-900">Timeline</h2>
        <ul className="mt-3 space-y-2.5">
          {m.renewedFrom && (
            <li className="text-sm">
              <span className="text-stone-500">Renewed from </span>
              <Link href={`/memberships/${m.renewedFrom.id}`} className="link">
                {dateOnly(m.renewedFrom.startDate)} → {dateOnly(m.renewedFrom.endDate)}
              </Link>
            </li>
          )}
          {m.renewedBy.map((r) => (
            <li key={r.id} className="text-sm">
              <span className="text-stone-500">Renewed into </span>
              <Link href={`/memberships/${r.id}`} className="link">
                {dateOnly(r.startDate)} → {dateOnly(r.endDate)}
              </Link>
            </li>
          ))}
          {m.statusHistory.map((h) => (
            <li key={h.id} className="flex gap-2 text-sm">
              <span className="badge">
                {h.from} → {h.to}
              </span>
              <span className="text-stone-500">
                {h.createdAt.slice(0, 16).replace("T", " ")}
                {h.reason ? ` · ${h.reason}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {m.cancelReason && (
          <p className="mt-2 text-sm text-stone-600">Cancel reason: {m.cancelReason}</p>
        )}
      </div>
    </div>
  );
}
