"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PAYMENT_METHODS } from "@o2app/shared";
import { ApiError, apiFetch, downloadFile } from "../../../../lib/api";
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
  ptTotal: string;
  ptDurationDays: number | null;
  ptDurationMonths: number | null;
  ptStart: string | null;
  ptTrainer: { id: string; name: string } | null;
  ptEnd: string | null;
  member: { id: string; memberCode: string; fullName: string; mobile: string };
  package: {
    id: string;
    name: string;
    durationValue: number;
    durationUnit: string;
    isActive: boolean;
  };
  invoice: {
    id: string;
    invoiceNo: string;
    status: string;
    subtotal: string;
    discount: string;
    taxable: string;
    gst: string;
    total: string;
    paid: string;
    outstanding: string;
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
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewPkg, setRenewPkg] = useState("");
  const [renewStart, setRenewStart] = useState("");
  const [renewDiscount, setRenewDiscount] = useState(0);
  const [renewPtTotal, setRenewPtTotal] = useState(0);
  const [renewPtDays, setRenewPtDays] = useState(0);
  const [renewPtStart, setRenewPtStart] = useState("");
  const [renewPtTrainer, setRenewPtTrainer] = useState("");
  const [extendDays, setExtendDays] = useState(30);
  const [cancelReason, setCancelReason] = useState("");
  // payment collection states
  const [payOpen, setPayOpen] = useState(searchParams.get("pay") === "1");
  const [payMode, setPayMode] = useState<"full" | "partial">("full");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payReference, setPayReference] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["membership", id],
    queryFn: () => apiFetch<Detail>(`/memberships/${id}`),
  });
  const packages = useQuery({
    queryKey: ["packages-sale"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/packages"),
  });
  const trainers = useQuery({
    queryKey: ["trainer-options"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/members/trainer-options"),
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
          discountPct: renewDiscount,
          ptTotal: renewPtTotal || undefined,
          ptDurationDays: renewPtTotal ? Math.max(1, Math.round(Number(renewPtDays))) : undefined,
          ptDurationMonths: renewPtTotal ? Math.max(1, Math.ceil(Number(renewPtDays) / 30)) : undefined,
          ptStart: renewPtTotal ? renewPtStart || undefined : undefined,
          ptTrainerId: renewPtTotal && renewPtTrainer ? renewPtTrainer : undefined,
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

  const method = PAYMENT_METHODS.find((pm) => pm.key === payMethod);
  const collect = useMutation({
    mutationFn: (amount: number) => {
      const d = detail.data;
      const inv = d?.invoice;
      if (!inv || !d)
        return Promise.reject(new ApiError(400, "No invoice", "No invoice on this membership"));
      return apiFetch(`/payments`, {
        method: "POST",
        body: JSON.stringify({
          memberId: d.member.id,
          method: payMethod,
          amount,
          reference: payReference || undefined,
          type: "membership",
          allocations: [{ invoiceId: inv.id, amount }],
          idempotencyKey:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
        }),
      });
    },
    onSuccess: (_d, amount) => {
      setPayError(null);
      setPayOpen(false);
      setPayAmount("");
      setPayReference("");
      const inv = detail.data?.invoice;
      const done = amount >= (Number(inv?.outstanding ?? 0) || Infinity);
      refresh(
        done
          ? `Full payment recorded for ${inv?.invoiceNo}.`
          : `Partial payment of ${inr(amount)} recorded for ${inv?.invoiceNo}.`,
      );
    },
    onError: (e) =>
      setPayError(e instanceof ApiError ? e.message : "Could not record payment — try again"),
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
  const canCollect = has("payments.collect");

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
            {m.invoice ? (
              Number(m.invoice.outstanding) > 0 ? (
                <>
                  {m.invoice.status === "unpaid" ? "Unpaid" : "Partly paid"} — {inr(m.invoice.outstanding)}{" "}
                  due
                </>
              ) : (
                "Fully paid"
              )
            ) : (
              "No invoice"
            )}
          </p>
          {m.invoice && (
            <button
              className="btn-ghost mt-2 px-2.5 py-1 text-xs"
              onClick={() => {
                const inv = m.invoice;
                if (inv)
                  downloadFile(`/memberships/${m.id}/pdf`, `${inv.invoiceNo}.pdf`).catch(() =>
                    window.alert("PDF download failed"),
                  );
              }}
            >
              ↓ Invoice PDF
            </button>
          )}
        </div>
      </div>

      {Number(m.ptTotal) > 0 && (
        <div className="card border-l-4 border-l-brand-600">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-stone-900">Personal training</h2>
            <span className="badge-blue">PT · {Number(m.ptTotal).toLocaleString("en-IN")}</span>
          </div>
          <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <p>
              <span className="text-stone-500">Trainer </span>
              <span className="font-medium">{m.ptTrainer?.name ?? "—"}</span>
            </p>
            <p>
              <span className="text-stone-500">Duration </span>
              <span className="font-medium">
                {m.ptDurationDays
                  ? `${m.ptDurationDays} day(s)`
                  : m.ptDurationMonths
                  ? `${m.ptDurationMonths} month(s)`
                  : "—"}
              </span>
            </p>
            <p>
              <span className="text-stone-500">Valid until </span>
              <span className="tabular-nums">{m.ptEnd ? dateOnly(m.ptEnd) : "—"}</span>
            </p>
            <p>
              <span className="text-stone-500">Started </span>
              <span className="tabular-nums">{m.ptStart ? dateOnly(m.ptStart) : "—"}</span>
            </p>
          </div>
          <p className="hint mt-2">
            PT fee is paid separately from this membership invoice — collect it under Billing →
            "Payment for: Personal training".
          </p>
        </div>
      )}

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

      {m.invoice && canCollect && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-stone-900">Payment</h2>
            {Number(m.invoice.outstanding) > 0 ? (
              <span className="badge-amber">
                {m.invoice.status === "unpaid" ? "Unpaid" : "Partly paid"} · {inr(m.invoice.paid)} of{" "}
                {inr(m.invoice.total)}
              </span>
            ) : (
              <span className="badge-green">Fully paid</span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Payment received for {m.invoice.invoiceNo}?{" "}
            {Number(m.invoice.outstanding) > 0
              ? `${inr(m.invoice.outstanding)} still due.`
              : "Nothing due — was a full payment."}
          </p>

          {Number(m.invoice.outstanding) > 0 && (
            <div className="mt-3">
              {!payOpen ? (
                <button className="btn-primary text-sm" onClick={() => setPayOpen(true)}>
                  Record payment…
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={payMode === "full"}
                        onChange={() => {
                          setPayMode("full");
                          setPayAmount("");
                          setPayError(null);
                        }}
                      />
                      <span className="font-medium">
                        Full payment ({inr(m.invoice.outstanding)})
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={payMode === "partial"}
                        onChange={() => setPayMode("partial")}
                      />
                      <span className="font-medium">Part payment</span>
                      {payMode === "partial" && (
                        <input
                          className="input w-32 py-1 text-sm"
                          type="number"
                          min={1}
                          max={Number(m.invoice.outstanding)}
                          value={payAmount}
                          onChange={(e) => {
                            setPayAmount(e.target.value);
                            setPayError(null);
                          }}
                          placeholder="₹ amount"
                        />
                      )}
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <select
                      className="input w-auto py-1.5 text-sm"
                      value={payMethod}
                      onChange={(e) => {
                        setPayMethod(e.target.value);
                        setPayError(null);
                      }}
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm.key} value={pm.key}>
                          {pm.label}
                        </option>
                      ))}
                    </select>
                    {method?.needsReference && (
                      <input
                        className="input w-52 py-1 text-sm"
                        value={payReference}
                        onChange={(e) => setPayReference(e.target.value)}
                        placeholder="Reference (txn / cheque no.)"
                      />
                    )}
                  </div>

                  {payError && <p className="alert-error text-sm">{payError}</p>}

                  <div className="flex gap-2">
                    <button
                      className="btn-primary text-sm"
                      disabled={collect.isPending}
                      onClick={() => {
                        const amount =
                          payMode === "full"
                            ? Number(m.invoice!.outstanding)
                            : Number(payAmount);
                        if (!Number.isFinite(amount) || amount <= 0) {
                          setPayError("Enter a valid part-payment amount");
                          return;
                        }
                        if (amount > Number(m.invoice!.outstanding) + 1e-9) {
                          setPayError(
                            `Part payment cannot exceed ${inr(m.invoice!.outstanding)}`,
                          );
                          return;
                        }
                        collect.mutate(amount);
                      }}
                    >
                      {collect.isPending
                        ? "Recording…"
                        : payMode === "full"
                        ? `Record full payment ${inr(m.invoice.outstanding)}`
                        : "Record part payment"}
                    </button>
                    <button
                      className="btn-ghost text-sm"
                      onClick={() => {
                        setPayOpen(false);
                        setPayError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
            <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
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
              <div>
                <label className="label">Discount %</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={renewDiscount}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => setRenewDiscount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">PT amount (₹, optional)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="1"
                  value={renewPtTotal || ""}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setRenewPtTotal(v);
                    if (v <= 0) setRenewPtDays(0);
                    else if (!renewPtDays) setRenewPtDays(30);
                  }}
                />
              </div>
              {renewPtTotal > 0 && (
                <>
                  <div>
                    <label className="label">PT duration (days) *</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={730}
                      step="1"
                      placeholder="e.g. 30, 45, 60, 90"
                      value={renewPtDays || ""}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRenewPtDays(val === "" ? 0 : Math.max(0, Math.round(Number(val))));
                      }}
                    />
                    <p className="hint">Duration in days (e.g. 30, 45, 60, 90)</p>
                  </div>
                  <div>
                    <label className="label">PT start</label>
                    <input
                      className="input"
                      type="date"
                      value={renewPtStart}
                      onChange={(e) => setRenewPtStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">PT trainer</label>
                    <select
                      className="input"
                      value={renewPtTrainer}
                      onChange={(e) => setRenewPtTrainer(e.target.value)}
                    >
                      <option value="">Select staff…</option>
                      {(trainers.data ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="flex items-end sm:col-span-4">
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
                  onWheel={(e) => e.currentTarget.blur()}
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
