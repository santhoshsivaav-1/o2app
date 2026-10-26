"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { apiFetch, downloadFile } from "../../../../lib/api";
import { inr, InvoiceStatusBadge } from "../../../../components/billing";

interface OutstandingRow {
  id: string;
  invoiceNo: string;
  member: { id: string; memberCode: string; fullName: string; mobile: string };
  total: number;
  paid: number;
  outstanding: number;
  status: string;
  issuedAt: string;
}

export default function PaymentFollowUpsPage() {
  const report = useQuery({
    queryKey: ["report-outstanding"],
    queryFn: () => apiFetch<OutstandingRow[]>(`/reports/outstanding`),
  });

  const data = report.data ?? [];
  const byMember = useMemo(() => {
    const map = new Map<
      string,
      { member: OutstandingRow["member"]; totalDue: number; invoices: OutstandingRow[] }
    >();
    for (const r of data) {
      const entry = map.get(r.member.id) ?? { member: r.member, totalDue: 0, invoices: [] };
      entry.totalDue += r.outstanding;
      entry.invoices.push(r);
      map.set(r.member.id, entry);
    }
    return [...map.values()].sort((a, b) => b.totalDue - a.totalDue);
  }, [data]);

  const grandDue = byMember.reduce((n, e) => n + e.totalDue, 0);

  if (report.isLoading) return <p className="text-sm text-stone-500">Loading follow-ups…</p>;
  if (report.error)
    return (
      <p className="alert-error text-sm">
        {report.error instanceof Error ? report.error.message : "Failed to load"} — this report
        needs the "Reports → Financial" permission.
      </p>
    );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Payment follow-ups</h2>
        <p className="mt-1 text-sm text-stone-600">
          Every membership invoice that is unpaid or only partly paid — fully paid invoices are
          excluded. Click a member to open their profile, payment history and collect the balance.
          {data.length > 0 && (
            <span className="font-medium text-stone-900">
              {" "}
              {byMember.length} member(s), {inr(grandDue)} total due.
            </span>
          )}
        </p>
      </div>

      {byMember.length === 0 && (
        <p className="card text-sm text-stone-500">
          Nothing to follow up — no unpaid or partly-paid invoices.
        </p>
      )}

      <ul className="space-y-3">
        {byMember.map((e) => (
          <li key={e.member.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/members/${e.member.id}`}
                className="text-sm font-semibold text-stone-900 hover:text-brand-700"
              >
                {e.member.fullName}
              </Link>
              <span className="badge-blue">{e.member.memberCode}</span>
              <span className="text-xs tabular-nums text-stone-500">{e.member.mobile}</span>
              <span className="ml-auto flex items-center gap-2 text-sm">
                <span className="font-bold tabular-nums">{inr(e.totalDue)} due</span>
                <Link href={`/members/${e.member.id}`} className="btn-primary px-2.5 py-1 text-xs">
                  Open member →
                </Link>
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {e.invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-stone-900">{inv.invoiceNo}</span>
                  <span className="tabular-nums text-stone-500">
                    total {inr(inv.total)} · paid {inr(inv.paid)}
                  </span>
                  <span className="tabular-nums font-medium">due {inr(inv.outstanding)}</span>
                  <InvoiceStatusBadge status={inv.status} />
                  <span className="tabular-nums text-stone-500">{inv.issuedAt.slice(0, 10)}</span>
                  <button
                    className="btn-ghost ml-auto px-2 py-0.5 text-xs"
                    onClick={() =>
                      downloadFile(`/invoices/${inv.id}/pdf`, `${inv.invoiceNo}.pdf`).catch(() =>
                        window.alert("PDF download failed"),
                      )
                    }
                  >
                    Invoice PDF
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
