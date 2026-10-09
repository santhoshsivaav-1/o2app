"use client";

import { PAYMENT_METHODS } from "@o2app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import {
  InvoiceStatusBadge,
  inr,
  methodLabel,
  type OpenInvoice,
  type PaymentRow,
} from "../../../components/billing";

interface MemberOption {
  id: string;
  memberCode: string;
  fullName: string;
  mobile: string;
}

type Tab = "collect" | "payments" | "invoices" | "reports";

export default function BillingPage() {
  const { has } = useAuth();
  const [tab, setTab] = useState<Tab>("collect");
  const canCollect = has("payments.collect");
  const canReport = has("reports.financial.read");

  if (!canCollect && !canReport)
    return (
      <div>
        <h1 className="page-title">Billing</h1>
        <div className="card mt-4">
          <p className="font-medium text-stone-900">Not permitted</p>
          <p className="mt-1 text-sm text-stone-500">Billing is restricted to front-desk staff.</p>
        </div>
      </div>
    );

  const allTabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "collect", label: "Collect payment", show: canCollect },
    { key: "payments", label: "Payments", show: canCollect },
    { key: "invoices", label: "Invoices", show: canCollect },
    { key: "reports", label: "Reports", show: canReport },
  ];
  const tabs = allTabs.filter((t) => t.show);
  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Billing</h1>
        <p className="page-sub">
          Record cash, UPI and card payments against invoices — all manual, all audited.
        </p>
      </div>
      <div className="flex gap-1 border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active === "collect" && <CollectTab />}
      {active === "payments" && <PaymentsTab />}
      {active === "invoices" && <InvoicesTab />}
      {active === "reports" && <ReportsTab />}
    </div>
  );
}

/* ---------------- collect ---------------- */

function CollectTab() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [memberId, setMemberId] = useState(searchParams.get("memberId") ?? "");
  const [search, setSearch] = useState("");
  const [allocs, setAllocs] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  const picked = useQuery({
    queryKey: ["bill-member", memberId],
    queryFn: () => apiFetch<MemberOption>(`/members/${memberId}`),
    enabled: !!memberId,
  });
  const found = useQuery({
    queryKey: ["bill-pick", search],
    queryFn: () =>
      apiFetch<{ data: MemberOption[] }>(`/members?q=${encodeURIComponent(search)}&limit=8`),
    enabled: search.trim().length >= 2 && !memberId,
  });
  const open = useQuery({
    queryKey: ["bill-open", memberId],
    queryFn: () => apiFetch<{ data: OpenInvoice[] }>(`/invoices?memberId=${memberId}&limit=50`),
    enabled: !!memberId,
  });

  const preInvoice = searchParams.get("invoiceId");
  useEffect(() => {
    if (preInvoice && open.data && !(preInvoice in allocs)) {
      const inv = open.data.data.find((i) => i.id === preInvoice);
      if (inv && inv.outstanding > 0) setAllocs((a) => ({ ...a, [preInvoice]: inv.outstanding }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preInvoice, open.data]);

  const openInvoices = useMemo(
    () => (open.data?.data ?? []).filter((i) => i.outstanding > 0),
    [open.data],
  );
  const allocSum = Object.values(allocs).reduce((n, v) => n + (Number(v) || 0), 0);

  const collect = useMutation({
    mutationFn: () =>
      apiFetch<{ payment: { id: string }; credit: { remaining: number } | null }>("/payments", {
        method: "POST",
        body: JSON.stringify({
          memberId,
          method,
          amount: allocSum,
          paidAt,
          reference: reference || undefined,
          allocations: Object.entries(allocs)
            .filter(([, v]) => Number(v) > 0)
            .map(([invoiceId, amount]) => ({ invoiceId, amount: Number(amount) })),
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    onSuccess: (d) => {
      setDoneId(d.payment.id);
      setAllocs({});
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["bill-open"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Payment failed"),
  });

  const needsRef = PAYMENT_METHODS.find((m) => m.key === method)?.needsReference;

  return (
    <div className="grid max-w-4xl gap-4">
      <div className="card">
        <h2 className="section-title">Member</h2>
        {memberId && picked.data ? (
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div>
              <p className="font-medium text-stone-900">{picked.data.fullName}</p>
              <p className="text-xs text-stone-500">
                {picked.data.memberCode} · {picked.data.mobile}
              </p>
            </div>
            <button
              className="btn-ghost ml-auto px-2.5 py-1 text-xs"
              onClick={() => {
                setMemberId("");
                setSearch("");
                setAllocs({});
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member…"
            />
            <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200">
              {found.data?.data.map((m) => (
                <li key={m.id}>
                  <button
                    className="flex w-full gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
                    onClick={() => {
                      setMemberId(m.id);
                      setSearch("");
                    }}
                  >
                    <span className="font-medium">{m.fullName}</span>
                    <span className="text-xs text-stone-500">{m.memberCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {memberId && (
        <div className="card">
          <h2 className="section-title">Open invoices</h2>
          {open.isLoading && <p className="mt-2 text-sm text-stone-500">Loading…</p>}
          {openInvoices.length === 0 && !open.isLoading && (
            <p className="mt-2 text-sm text-stone-500">No outstanding invoices for this member.</p>
          )}
          <ul className="mt-2 space-y-2">
            {openInvoices.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 p-3 text-sm"
              >
                <div>
                  <Link href={`/billing/invoices/${inv.id}`} className="link">
                    {inv.invoiceNo}
                  </Link>
                  <p className="text-xs text-stone-500">
                    Outstanding {inr(inv.outstanding)} of {inr(inv.total)}
                  </p>
                </div>
                <input
                  className="input ml-auto w-32"
                  type="number"
                  min={0}
                  max={inv.outstanding}
                  step="0.01"
                  value={allocs[inv.id] ?? ""}
                  placeholder={String(inv.outstanding)}
                  onChange={(e) => setAllocs((a) => ({ ...a, [inv.id]: Number(e.target.value) }))}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {memberId && (
        <div className="card">
          <h2 className="section-title">Payment</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Method *</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Reference {needsRef ? "*" : "(optional)"}</label>
              <input
                className="input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={needsRef ? "UPI ref / txn id" : "—"}
              />
            </div>
            <div>
              <label className="label">Paid on</label>
              <input
                className="input"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>
          <p className="hint mt-2">
            Manually recorded payments are labelled as such on the receipt — they are not
            gateway-verified.
          </p>
          {error && (
            <p role="alert" className="alert-error mt-3">
              {error}
            </p>
          )}
          {doneId && (
            <p className="alert-ok mt-3">
              Payment recorded.{" "}
              <Link href={`/billing/payments/${doneId}`} className="link">
                Open receipt →
              </Link>
            </p>
          )}
          <div className="mt-4 flex items-center gap-3 border-t border-stone-100 pt-4">
            <p className="text-lg font-bold tabular-nums">Total {inr(allocSum)}</p>
            <button
              className="btn-primary ml-auto"
              disabled={allocSum <= 0 || collect.isPending}
              onClick={() => {
                setError(null);
                setDoneId(null);
                collect.mutate();
              }}
            >
              {collect.isPending ? "Recording…" : "Record payment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- payments ---------------- */

function PaymentsTab() {
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (method) params.set("method", method);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const list = useQuery({
    queryKey: ["payments", params.toString()],
    queryFn: () => apiFetch<{ data: PaymentRow[]; meta: { total: number } }>(`/payments?${params}`),
  });
  const total = list.data?.meta.total ?? 0;

  return (
    <div className="space-y-4">
      <form
        className="card grid gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          list.refetch();
        }}
      >
        <div>
          <label className="label">Method</label>
          <select
            className="input"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input
            className="input"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            className="input"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-end">
          <span className="badge">{total} payments</span>
        </div>
      </form>
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Paid on</th>
              <th>Check</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.data.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link
                    href={`/billing/payments/${p.id}`}
                    className="font-medium text-stone-900 hover:text-brand-700"
                  >
                    {p.member.fullName}
                  </Link>
                  <p className="text-xs text-stone-500">{p.member.memberCode}</p>
                </td>
                <td>{methodLabel(p.method)}</td>
                <td className="font-medium tabular-nums">{inr(p.amount)}</td>
                <td className="tabular-nums text-stone-500">{p.paidAt.slice(0, 10)}</td>
                <td>
                  {p.verified ? (
                    <span className="badge-green">Verified</span>
                  ) : (
                    <span className="badge">Manual</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.isLoading && <p className="p-4 text-sm text-stone-500">Loading…</p>}
        <div className="flex items-center gap-3 border-t border-stone-200 bg-stone-50 px-4 py-2.5 text-sm">
          <button
            className="btn-ghost px-3 py-1 text-xs"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ← Prev
          </button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setPage(page + 1)}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- invoices ---------------- */

function InvoicesTab() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) params.set("status", status);
  const list = useQuery({
    queryKey: ["invoices", params.toString()],
    queryFn: () =>
      apiFetch<{
        data: {
          id: string;
          invoiceNo: string;
          total: string;
          paid: number;
          outstanding: number;
          status: string;
          member: { memberCode: string; fullName: string };
        }[];
        meta: { total: number };
      }>(`/invoices?${params}`),
  });

  function downloadCsv() {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/exports/invoices?${status ? `status=${status}` : ""}`;
    fetch(url, { credentials: "include" }).then(async (res) => {
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "invoices.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input w-48"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
        <button className="btn-ghost ml-auto text-sm" onClick={downloadCsv}>
          Export CSV
        </button>
      </div>
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Member</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Outstanding</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.data.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <Link href={`/billing/invoices/${inv.id}`} className="link">
                    {inv.invoiceNo}
                  </Link>
                </td>
                <td>
                  {inv.member.fullName}
                  <p className="text-xs text-stone-500">{inv.member.memberCode}</p>
                </td>
                <td className="tabular-nums">{inr(inv.total)}</td>
                <td className="tabular-nums">{inr(inv.paid)}</td>
                <td className="font-medium tabular-nums">{inr(inv.outstanding)}</td>
                <td>
                  <InvoiceStatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.isLoading && <p className="p-4 text-sm text-stone-500">Loading…</p>}
        <div className="flex items-center gap-3 border-t border-stone-200 bg-stone-50 px-4 py-2.5 text-sm">
          <button
            className="btn-ghost px-3 py-1 text-xs"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ← Prev
          </button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setPage(page + 1)}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- reports ---------------- */

function ReportsTab() {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 8) + "01");
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const range = `from=${from}&to=${to}`;
  const collections = useQuery({
    queryKey: ["rep-collections", range],
    queryFn: () =>
      apiFetch<{
        days: {
          date: string;
          paid: number;
          refunded: number;
          net: number;
          byMethod: Record<string, number>;
        }[];
        totals: { paid: number; refunded: number; net: number };
      }>(`/reports/collections?${range}`),
  });
  const outstanding = useQuery({
    queryKey: ["rep-outstanding"],
    queryFn: () =>
      apiFetch<
        {
          invoiceNo: string;
          id: string;
          total: number;
          paid: number;
          outstanding: number;
          member: { memberCode: string; fullName: string };
        }[]
      >("/reports/outstanding"),
  });
  const refunds = useQuery({
    queryKey: ["rep-refunds", range],
    queryFn: () =>
      apiFetch<{
        total: number;
        data: { id: string; amount: string; reason: string; createdAt: string }[];
      }>(`/reports/refunds?${range}`),
  });
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  function csv(path: string, name: string) {
    fetch(`${API}${path}`, { credentials: "include" }).then(async (res) => {
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">From</label>
          <input
            className="input"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button
          className="btn-ghost ml-auto text-sm"
          onClick={() => {
            collections.refetch();
            refunds.refetch();
          }}
        >
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Collections</h2>
          <button
            className="btn-ghost ml-auto px-2.5 py-1 text-xs"
            onClick={() => csv(`/exports/collections?${range}`, "collections.csv")}
          >
            Export CSV
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="section-title">Collected</p>
            <p className="text-xl font-bold tabular-nums">
              {inr(collections.data?.totals.paid ?? 0)}
            </p>
          </div>
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="section-title">Refunded</p>
            <p className="text-xl font-bold tabular-nums">
              {inr(collections.data?.totals.refunded ?? 0)}
            </p>
          </div>
          <div className="rounded-lg bg-orange-50 p-3">
            <p className="section-title">Net</p>
            <p className="text-xl font-bold tabular-nums text-brand-700">
              {inr(collections.data?.totals.net ?? 0)}
            </p>
          </div>
        </div>
        <table className="table mt-3">
          <thead>
            <tr>
              <th>Date</th>
              <th>Collected</th>
              <th>Refunded</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {collections.data?.days.map((d) => (
              <tr key={d.date}>
                <td className="tabular-nums">{d.date}</td>
                <td className="tabular-nums">{inr(d.paid)}</td>
                <td className="tabular-nums">{inr(d.refunded)}</td>
                <td className="font-medium tabular-nums">{inr(d.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Outstanding balances</h2>
          <span className="badge">{outstanding.data?.length ?? 0} invoices</span>
          <button
            className="btn-ghost ml-auto px-2.5 py-1 text-xs"
            onClick={() => csv("/exports/outstanding", "outstanding.csv")}
          >
            Export CSV
          </button>
        </div>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Member</th>
              <th className="text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {(outstanding.data ?? []).slice(0, 20).map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/billing/invoices/${o.id}`} className="link">
                    {o.invoiceNo}
                  </Link>
                </td>
                <td>{o.member.fullName}</td>
                <td className="text-right font-medium tabular-nums">{inr(o.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold">
          Refunds{" "}
          <span className="ml-1 text-sm font-normal text-stone-500">
            total {inr(refunds.data?.total ?? 0)}
          </span>
        </h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {refunds.data?.data.map((r) => (
              <tr key={r.id}>
                <td className="tabular-nums">{r.createdAt.slice(0, 10)}</td>
                <td className="tabular-nums">{inr(r.amount)}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
