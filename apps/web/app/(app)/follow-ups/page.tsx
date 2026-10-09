"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";

interface QueueItem {
  id: string;
  activity: string;
  note: string | null;
  dueAt: string | null;
  overdue: boolean;
  enquiry: {
    id: string;
    enquiryNo: string;
    name: string;
    phone: string;
    status: string;
    assignedTo: { id: string; name: string } | null;
  };
}

type Scope = "overdue" | "upcoming" | "all";

export default function FollowUpsPage() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<Scope>("overdue");
  const [assignedToId, setAssignedToId] = useState("");

  const assignees = useQuery({
    queryKey: ["assignees"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/enquiries/assignees"),
  });
  const queue = useQuery({
    queryKey: ["followup-queue", scope, assignedToId],
    queryFn: () =>
      apiFetch<{ scope: string; data: QueueItem[] }>(
        `/follow-ups?scope=${scope}${assignedToId ? `&assignedToId=${assignedToId}` : ""}`,
      ),
  });

  const done = useMutation({
    mutationFn: (fid: string) =>
      apiFetch(`/follow-ups/${fid}/complete`, { method: "PATCH", body: "{}" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-queue"] });
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
    },
    onError: (e) => alert(e instanceof ApiError ? e.message : "Failed"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Follow-ups</h1>
        <p className="page-sub">
          The next required action on every open lead — work it top to bottom.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1 shadow-sm">
          {(["overdue", "upcoming", "all"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                scope === s ? "bg-brand-600 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          className="input w-52"
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
        >
          <option value="">Everyone</option>
          {assignees.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span className="badge">{queue.data?.data.length ?? 0} items</span>
      </div>

      <div className="card space-y-2.5">
        {queue.isLoading && <p className="text-sm text-stone-500">Loading queue…</p>}
        {queue.data?.data.map((f) => (
          <div
            key={f.id}
            className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${f.overdue ? "border-red-200 bg-red-50/50" : "border-stone-200"}`}
          >
            <div className="min-w-0">
              <Link
                href={`/enquiries/${f.enquiry.id}`}
                className="font-medium text-stone-900 hover:text-brand-700"
              >
                {f.enquiry.name}
              </Link>
              <p className="text-xs text-stone-500">
                {f.enquiry.enquiryNo} · {f.enquiry.phone} ·{" "}
                {f.enquiry.assignedTo?.name ?? "unassigned"}
              </p>
              {f.note && <p className="mt-1 text-sm text-stone-700">{f.note}</p>}
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="badge">{f.activity}</span>
              {f.dueAt ? (
                <span
                  className={`tabular-nums ${f.overdue ? "font-semibold text-red-600" : "text-stone-500"}`}
                >
                  due {f.dueAt.slice(0, 16).replace("T", " ")}
                </span>
              ) : (
                <span className="text-stone-400">no due date</span>
              )}
              <button
                className="btn-primary px-2.5 py-1 text-xs"
                onClick={() => done.mutate(f.id)}
                disabled={done.isPending}
              >
                Done
              </button>
            </div>
          </div>
        ))}
        {queue.data?.data.length === 0 && (
          <div className="p-6 text-center">
            <p className="font-medium">Queue clear 🎉</p>
            <p className="mt-1 text-sm text-stone-500">
              Nothing {scope === "all" ? "pending" : scope} right now.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
