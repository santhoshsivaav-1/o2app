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
    // Cookies go along; CSRF not needed for GET.
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
        <h1 className="text-lg font-semibold">Members</h1>
        <span className="badge">{total} total</span>
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
        className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          members.refetch();
        }}
      >
        <div className="lg:col-span-2">
          <label className="label">Search name, code or mobile</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Asha, O2-2026-, 98765"
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="label">Gender</label>
          <select
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
        <div className="flex items-end gap-2">
          <div className="flex-1">
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
          <div className="flex-1">
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
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
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
              <tr key={m.id} className="hover:bg-stone-800/30">
                <td>
                  <Link href={`/members/${m.id}`} className="text-brand-300 hover:underline">
                    {m.memberCode}
                  </Link>
                </td>
                <td>
                  <Link href={`/members/${m.id}`} className="hover:underline">
                    {m.fullName}
                  </Link>
                </td>
                <td className="text-stone-400">{m.mobile}</td>
                <td>{m.gender.name}</td>
                <td>
                  <span className="badge">{m.status}</span>
                </td>
                <td className="text-stone-400">{m.registrationDate.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.isLoading && <p className="p-4 text-sm text-stone-500">Loading…</p>}
        {members.data?.data.length === 0 && (
          <p className="p-4 text-sm text-stone-500">
            No members match — try a different search or register a new member.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button
          className="btn-ghost px-3 py-1"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          ← Prev
        </button>
        <span className="text-stone-400">
          Page {page} of {pages}
        </span>
        <button
          className="btn-ghost px-3 py-1"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
