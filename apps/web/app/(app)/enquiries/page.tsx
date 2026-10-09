"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../../../lib/api";
import { EnquiryStatusBadge, type EnquiryRow } from "../../../components/enquiries";

export default function EnquiriesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [source, setSource] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);

  const assignees = useQuery({
    queryKey: ["assignees"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/enquiries/assignees"),
  });
  const sources = useQuery({
    queryKey: ["enquiry-sources"],
    queryFn: () => apiFetch<{ source: string; count: number }[]>("/enquiries/sources"),
  });

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (assignedToId) params.set("assignedToId", assignedToId);
  if (source) params.set("source", source);
  if (overdueOnly) params.set("overdue", "true");

  const list = useQuery({
    queryKey: ["enquiries", params.toString()],
    queryFn: () =>
      apiFetch<{ data: EnquiryRow[]; meta: { total: number } }>(`/enquiries?${params}`),
  });
  const total = list.data?.meta.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">Enquiries</h1>
          <p className="page-sub">
            {total} leads · conversion happens explicitly, never by accident
          </p>
        </div>
        <Link href="/enquiries/new" className="btn-primary ml-auto text-sm">
          + New enquiry
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
          <label className="label">Search</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone or ENQ-…"
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
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="follow_up">Follow-up required</option>
            <option value="trial">Trial scheduled</option>
            <option value="interested">Interested</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <div>
          <label className="label">Assigned to</label>
          <select
            className="input"
            value={assignedToId}
            onChange={(e) => {
              setAssignedToId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Anyone</option>
            {assignees.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Source</label>
          <select
            className="input"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All sources</option>
            {sources.data?.map((s) => (
              <option key={s.source} value={s.source}>
                {s.source} ({s.count})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              className="h-4 w-4 accent-orange-600"
              checked={overdueOnly}
              onChange={(e) => {
                setOverdueOnly(e.target.checked);
                setPage(1);
              }}
            />
            Overdue follow-ups only
          </label>
        </div>
      </form>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Next action</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.data.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link
                    href={`/enquiries/${e.id}`}
                    className="font-medium text-stone-900 hover:text-brand-700"
                  >
                    {e.name}
                  </Link>
                  <p className="text-xs text-stone-500">{e.enquiryNo}</p>
                </td>
                <td className="tabular-nums text-stone-500">{e.phone}</td>
                <td>
                  <EnquiryStatusBadge status={e.status} />
                </td>
                <td className="text-xs tabular-nums">
                  {e.nextFollowUpAt ? (
                    <span className={e.overdue ? "font-semibold text-red-600" : "text-stone-500"}>
                      {e.nextFollowUpAt.slice(0, 16).replace("T", " ")}
                      {e.overdue ? " · overdue" : ""}
                    </span>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <td className="text-stone-500">{e.assignedTo?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.isLoading && <p className="p-4 text-sm text-stone-500">Loading…</p>}
        {list.data?.data.length === 0 && (
          <div className="p-8 text-center">
            <p className="font-medium">No enquiries match</p>
            <p className="mt-1 text-sm text-stone-500">Log the first lead to start the pipeline.</p>
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
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setPage(page + 1)}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
