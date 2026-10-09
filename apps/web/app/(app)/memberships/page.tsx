"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../../../lib/api";
import { ValidityBadge, dateOnly, inr, type MembershipRow } from "../../../components/memberships";

export default function MembershipsPage() {
  const [q, setQ] = useState("");
  const [validity, setValidity] = useState("");
  const [packageId, setPackageId] = useState("");
  const [expiringBefore, setExpiringBefore] = useState("");
  const [page, setPage] = useState(1);

  const packages = useQuery({
    queryKey: ["packages-lite"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/packages?includeInactive=true"),
  });

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (validity) params.set("validity", validity);
  if (packageId) params.set("packageId", packageId);
  if (expiringBefore) params.set("expiringBefore", expiringBefore);
  params.set("page", String(page));
  params.set("limit", "20");

  const list = useQuery({
    queryKey: ["memberships", params.toString()],
    queryFn: () =>
      apiFetch<{ data: MembershipRow[]; meta: { page: number; limit: number; total: number } }>(
        `/memberships?${params.toString()}`,
      ),
  });

  const total = list.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">Memberships</h1>
          <p className="page-sub">
            {total} records · every sale, renewal and cancellation preserved
          </p>
        </div>
        <Link href="/memberships/new" className="btn-primary ml-auto text-sm">
          + New membership
        </Link>
      </div>

      <form
        className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          list.refetch();
        }}
      >
        <div className="lg:col-span-2">
          <label className="label" htmlFor="sq">
            Search member
          </label>
          <input
            id="sq"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, code or mobile"
          />
        </div>
        <div>
          <label className="label" htmlFor="svalid">
            Validity
          </label>
          <select
            id="svalid"
            className="input"
            value={validity}
            onChange={(e) => {
              setValidity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="spkg">
            Package
          </label>
          <select
            id="spkg"
            className="input"
            value={packageId}
            onChange={(e) => {
              setPackageId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All packages</option>
            {packages.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sexp">
            Expiring before
          </label>
          <input
            id="sexp"
            className="input"
            type="date"
            value={expiringBefore}
            onChange={(e) => {
              setExpiringBefore(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </form>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Package</th>
              <th>Period</th>
              <th>Total</th>
              <th>Validity</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.data.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link
                    href={`/memberships/${m.id}`}
                    className="font-medium text-stone-900 hover:text-brand-700"
                  >
                    {m.member.fullName}
                  </Link>
                  <p className="text-xs text-stone-500">{m.member.memberCode}</p>
                </td>
                <td>{m.package.name}</td>
                <td className="whitespace-nowrap tabular-nums text-stone-500">
                  {dateOnly(m.startDate)} → {dateOnly(m.endDate)}
                </td>
                <td className="font-medium tabular-nums">{inr(m.total)}</td>
                <td>
                  <ValidityBadge validity={m.validity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.isLoading && <p className="p-4 text-sm text-stone-500">Loading memberships…</p>}
        {list.data?.data.length === 0 && (
          <div className="p-8 text-center">
            <p className="font-medium text-stone-900">No memberships match</p>
            <p className="mt-1 text-sm text-stone-500">Sell the first membership to get started.</p>
          </div>
        )}
        <div className="flex items-center gap-3 border-t border-stone-200 bg-stone-50 px-4 py-2.5 text-sm">
          <button
            className="btn-ghost px-3 py-1 text-xs"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ← Prev
          </button>
          <span className="text-stone-500">
            Page {page} of {pages}
          </span>
          <button
            className="btn-ghost px-3 py-1 text-xs"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
