"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

interface Gender {
  id: string;
  name: string;
}

interface MemberRow {
  id: string;
  memberCode: string;
  fullName: string;
  mobile: string;
  email: string | null;
  status: string;
  registrationDate: string;
  gender: Gender;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <span className="badge-green">Active</span>;
  if (status === "inactive") return <span className="badge-amber">Inactive</span>;
  return <span className="badge">Archived</span>;
}

export default function MembersPage() {
  const { has } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [genderId, setGenderId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const genders = useQuery({
    queryKey: ["genders"],
    queryFn: () => apiFetch<Gender[]>("/genders"),
  });

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (genderId) params.set("genderId", genderId);
  if (from) params.set("registeredFrom", from);
  if (to) params.set("registeredTo", to);
  params.set("page", String(page));
  params.set("limit", "20");

  const members = useQuery({
    queryKey: ["members", params.toString()],
    queryFn: () =>
      apiFetch<{ data: MemberRow[]; meta: { page: number; limit: number; total: number } }>(
        `/members?${params.toString()}`,
      ),
  });

  function downloadExport() {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/members/export?${params.toString()}`;
    fetch(url, { credentials: "include" }).then(async (res) => {
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "members.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  const total = members.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">Members</h1>
          <p className="page-sub">{total} registered · search by name, code or mobile</p>
        </div>
        <span className="ml-auto flex gap-2">
          {has("data.export") && (
            <button className="btn-ghost text-sm" onClick={downloadExport}>
              Export CSV
            </button>
          )}
          {has("members.create") && (
            <Link href="/members/new" className="btn-primary text-sm">
              + New member
            </Link>
          )}
        </span>
      </div>

      <form
        className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          members.refetch();
        }}
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="label" htmlFor="mq">
            Search
          </label>
          <input
            id="mq"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Asha, O2-2026-, 98765"
          />
        </div>
        <div>
          <label className="label" htmlFor="mstatus">
            Status
          </label>
          <select
            id="mstatus"
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mgender">
            Gender
          </label>
          <select
            id="mgender"
            className="input"
            value={genderId}
            onChange={(e) => {
              setGenderId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {genders.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mfrom">
            Registered from
          </label>
          <input
            id="mfrom"
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
          <label className="label" htmlFor="mto">
            Registered to
          </label>
          <input
            id="mto"
            className="input"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-2">
          <button className="btn-primary text-sm" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Gender</th>
              <th>Status</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {members.data?.data.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/members/${m.id}`} className="link">
                    {m.memberCode}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/members/${m.id}`}
                    className="font-medium text-stone-900 hover:text-brand-700"
                  >
                    {m.fullName}
                  </Link>
                </td>
                <td className="tabular-nums text-stone-500">{m.mobile}</td>
                <td>{m.gender.name}</td>
                <td>
                  <StatusBadge status={m.status} />
                </td>
                <td className="text-stone-500">{m.registrationDate.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.isLoading && <p className="p-4 text-sm text-stone-500">Loading members…</p>}
        {members.data?.data.length === 0 && (
          <div className="p-8 text-center">
            <p className="font-medium text-stone-900">No members match</p>
            <p className="mt-1 text-sm text-stone-500">
              Try a different search, or register a new member.
            </p>
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
