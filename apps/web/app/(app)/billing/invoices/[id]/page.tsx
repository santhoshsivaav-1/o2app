"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "../../../../../lib/api";
import { InvoiceStatusBadge, inr, methodLabel } from "../../../../../components/billing";

interface InvoiceDetail {
  id: string;
  invoiceNo: string;
  status: string;
  subtotal: string;
  discount: string;
  taxable: string;
  gst: string;
  total: string;
  paid: number;
  refunded: number;
  outstanding: number;
  issuedAt: string;
  member: { id: string; memberCode: string; fullName: string; mobile: string };
  membership: { id: string; startDate: string; endDate: string } | null;
  items: { id: string; label: string; qty: number; unitPrice: string; amount: string }[];
  allocations: {
    id: string;
    amount: string;
    payment: { id: string; method: string; paidAt: string };
  }[];
  refunds: { id: string; amount: string; reason: string; createdAt: string }[];
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const inv = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => apiFetch<InvoiceDetail>(`/invoices/${id}`),
  });

  if (inv.isLoading) return <p className="text-sm text-stone-500">Loading invoice…</p>;
  if (inv.error || !inv.data)
    return (
      <div className="card">
        <p className="alert-error">Invoice not found.</p>
        <Link href="/billing" className="btn-ghost mt-3 inline-flex text-sm">
          ← Billing
        </Link>
      </div>
    );
  const d = inv.data;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href="/billing" className="text-sm font-medium text-stone-500 hover:text-stone-800">
          ← Billing
        </Link>
        <h1 className="page-title">{d.invoiceNo}</h1>
        <InvoiceStatusBadge status={d.status} />
        <Link
          href={`/billing?memberId=${d.member.id}&invoiceId=${d.id}`}
          className="btn-primary ml-auto text-sm"
        >
          Record payment
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <p>
            <span className="text-stone-500">Billed to </span>
            <Link href={`/members/${d.member.id}`} className="link">
              {d.member.fullName}
            </Link>
            <span className="text-stone-500"> · {d.member.memberCode}</span>
          </p>
          <p className="text-stone-500">Issued {d.issuedAt.slice(0, 10)}</p>
          {d.membership && (
            <p>
              <span className="text-stone-500">Membership </span>
              <Link href={`/memberships/${d.membership.id}`} className="link">
                {d.membership.startDate.slice(0, 10)} → {d.membership.endDate.slice(0, 10)}
              </Link>
            </p>
          )}
        </div>
        <table className="table mt-3">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((it) => (
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
            <dd className="tabular-nums">{inr(d.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Discount</dt>
            <dd className="tabular-nums">− {inr(d.discount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">GST</dt>
            <dd className="tabular-nums">+ {inr(d.gst)}</dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-1 font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{inr(d.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Paid</dt>
            <dd className="tabular-nums">{inr(d.paid)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Refunded</dt>
            <dd className="tabular-nums">{inr(d.refunded)}</dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-1 font-bold text-brand-700">
            <dt>Outstanding</dt>
            <dd className="tabular-nums">{inr(d.outstanding)}</dd>
          </div>
        </dl>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold">Payments against this invoice</h2>
        {d.allocations.length === 0 && (
          <p className="mt-1 text-sm text-stone-500">No payments yet.</p>
        )}
        <ul className="mt-2 space-y-2">
          {d.allocations.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <Link href={`/billing/payments/${a.payment.id}`} className="link">
                {inr(a.amount)}
              </Link>
              <span className="text-stone-500">
                · {methodLabel(a.payment.method)} · {a.payment.paidAt.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {d.refunds.length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold">Refunds</h2>
          <ul className="mt-2 space-y-2">
            {d.refunds.map((r) => (
              <li key={r.id} className="text-sm">
                <span className="font-medium tabular-nums">{inr(r.amount)}</span>
                <span className="text-stone-500">
                  {" "}
                  · {r.reason} · {r.createdAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
