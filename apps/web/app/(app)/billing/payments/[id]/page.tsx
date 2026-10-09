"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../../../lib/api";
import { useAuth } from "../../../../../lib/auth";
import { inr, methodLabel } from "../../../../../components/billing";

interface Receipt {
  id: string;
  method: string;
  amount: string;
  paidAt: string;
  reference: string | null;
  verified: boolean;
  refunded: number;
  member: { id: string; memberCode: string; fullName: string; mobile: string };
  allocations: {
    id: string;
    amount: string;
    invoice: { id: string; invoiceNo: string; total: string };
  }[];
  refunds: { id: string; amount: string; reason: string; createdAt: string }[];
  credits: { id: string; amount: string; remaining: string }[];
}

export default function ReceiptPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { has } = useAuth();
  const queryClient = useQueryClient();
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const pay = useQuery({
    queryKey: ["payment", id],
    queryFn: () => apiFetch<Receipt>(`/payments/${id}`),
  });

  const refund = useMutation({
    mutationFn: () =>
      apiFetch(`/payments/${id}/refund`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(refundAmount), reason: refundReason }),
      }),
    onSuccess: () => {
      setMsg("Refund recorded.");
      setRefundAmount("");
      setRefundReason("");
      queryClient.invalidateQueries({ queryKey: ["payment", id] });
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : "Refund failed"),
  });

  if (pay.isLoading) return <p className="text-sm text-stone-500">Loading receipt…</p>;
  if (pay.error || !pay.data)
    return (
      <div className="card">
        <p className="alert-error">Payment not found.</p>
        <Link href="/billing" className="btn-ghost mt-3 inline-flex text-sm">
          ← Billing
        </Link>
      </div>
    );
  const p = pay.data;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="no-print flex items-center gap-2">
        <Link href="/billing" className="text-sm font-medium text-stone-500 hover:text-stone-800">
          ← Billing
        </Link>
        <button className="btn-primary ml-auto text-sm" onClick={() => window.print()}>
          Print receipt
        </button>
      </div>

      <div className="card">
        <div className="border-b border-stone-200 pb-4 text-center">
          <p className="text-lg font-black tracking-wide text-brand-700">
            O2 OXYGEN FITNESS STUDIO
          </p>
          <p className="text-xs text-stone-500">
            Payment receipt · {p.paidAt.slice(0, 16).replace("T", " ")}
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-stone-500">Receipt</dt>
            <dd className="font-mono font-medium">RCP-{p.id.slice(0, 8).toUpperCase()}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Member</dt>
            <dd className="font-medium">
              {p.member.fullName} · {p.member.memberCode}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Method</dt>
            <dd>{methodLabel(p.method)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Reference</dt>
            <dd>{p.reference ?? "—"}</dd>
          </div>
        </dl>
        <table className="table mt-4">
          <thead>
            <tr>
              <th>Applied to</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {p.allocations.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/billing/invoices/${a.invoice.id}`} className="link no-print">
                    {a.invoice.invoiceNo}
                  </Link>
                  <span className="print:hidden hidden">{a.invoice.invoiceNo}</span>
                </td>
                <td className="text-right tabular-nums">{inr(a.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex justify-between border-t border-stone-200 pt-3 text-lg font-bold">
          <span>Total received</span>
          <span className="tabular-nums">{inr(p.amount)}</span>
        </div>
        {p.refunded > 0 && (
          <p className="mt-1 text-right text-sm text-stone-500">
            Refunded so far: {inr(p.refunded)}
          </p>
        )}
        <p className="mt-3 rounded-lg bg-stone-50 p-2.5 text-xs leading-relaxed text-stone-500">
          {p.verified
            ? "Gateway-verified payment."
            : "Manually recorded payment — not gateway-verified. UPI/card entries reflect the front desk's record, not a bank confirmation."}
        </p>
      </div>

      {p.credits.length > 0 && (
        <div className="card no-print">
          <h2 className="text-base font-semibold">Credit from this payment</h2>
          {p.credits.map((c) => (
            <p key={c.id} className="mt-1 text-sm">
              {inr(c.remaining)} of {inr(c.amount)} available as member advance.
            </p>
          ))}
        </div>
      )}

      {has("payments.refund") && (
        <div className="card no-print">
          <h2 className="text-base font-semibold">Record refund</h2>
          <p className="page-sub">
            Refunds are separate audited events — the original payment is never edited or deleted.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Amount (₹)</label>
              <input
                className="input"
                type="number"
                min={0.01}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Reason *</label>
              <input
                className="input"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Duplicate charge returned"
              />
            </div>
          </div>
          {msg && <p className="mt-3 text-sm">{msg}</p>}
          <button
            className="btn-danger mt-3 text-sm"
            disabled={!refundAmount || !refundReason.trim() || refund.isPending}
            onClick={() => refund.mutate()}
          >
            {refund.isPending ? "Recording…" : "Record refund"}
          </button>
        </div>
      )}
    </div>
  );
}
