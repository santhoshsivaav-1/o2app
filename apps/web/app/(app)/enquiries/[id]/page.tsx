"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../../lib/api";
import { EnquiryStatusBadge } from "../../../../components/enquiries";

interface FollowUp {
  id: string;
  activity: string;
  note: string | null;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
}

interface Detail {
  id: string;
  enquiryNo: string;
  name: string;
  phone: string;
  email: string | null;
  interest: string | null;
  source: string | null;
  enquiryDate: string;
  status: string;
  nextFollowUpAt: string | null;
  notes: string | null;
  assignedTo: { id: string; name: string } | null;
  interestPackage: { id: string; name: string } | null;
  convertedMember: { id: string; memberCode: string; fullName: string } | null;
  followUps: FollowUp[];
}

const STATUSES = ["new", "contacted", "follow_up", "trial", "interested", "lost"] as const;
const ACTIVITIES = ["call", "visit", "trial", "note", "other"] as const;

export default function EnquiryDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);
  const [fu, setFu] = useState({ activity: "call", note: "", dueAt: "" });
  const [convertOpen, setConvertOpen] = useState(false);
  const [genderId, setGenderId] = useState("");
  const [dupe, setDupe] = useState<
    { id: string; memberCode: string; fullName: string; mobile: string }[] | null
  >(null);

  const detail = useQuery({
    queryKey: ["enquiry", id],
    queryFn: () => apiFetch<Detail>(`/enquiries/${id}`),
  });
  const assignees = useQuery({
    queryKey: ["assignees"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/enquiries/assignees"),
  });
  const genders = useQuery({
    queryKey: ["genders"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/genders"),
  });

  function ok(m: string) {
    setMsgOk(true);
    setMsg(m);
    queryClient.invalidateQueries({ queryKey: ["enquiry", id] });
    queryClient.invalidateQueries({ queryKey: ["enquiries"] });
    queryClient.invalidateQueries({ queryKey: ["followup-queue"] });
  }
  function fail(e: unknown) {
    setMsgOk(false);
    setMsg(e instanceof ApiError ? e.message : "Action failed");
  }

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/enquiries/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => ok("Saved."),
    onError: fail,
  });
  const addFu = useMutation({
    mutationFn: () =>
      apiFetch(`/enquiries/${id}/follow-ups`, {
        method: "POST",
        body: JSON.stringify({
          activity: fu.activity,
          note: fu.note || undefined,
          dueAt: fu.dueAt ? new Date(fu.dueAt).toISOString() : undefined,
        }),
      }),
    onSuccess: () => {
      setFu({ activity: "call", note: "", dueAt: "" });
      ok("Follow-up logged.");
    },
    onError: fail,
  });
  const doneFu = useMutation({
    mutationFn: (fid: string) =>
      apiFetch(`/follow-ups/${fid}/complete`, { method: "PATCH", body: "{}" }),
    onSuccess: () => ok("Marked done."),
    onError: fail,
  });
  const convert = useMutation({
    mutationFn: () =>
      apiFetch<{ convertedMember: { id: string } }>(`/enquiries/${id}/convert`, {
        method: "POST",
        body: JSON.stringify({ genderId }),
      }),
    onSuccess: (d) => router.replace(`/members/${d.convertedMember.id}`),
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        const details = e.details as { matches?: NonNullable<typeof dupe> } | null;
        setDupe(details?.matches ?? []);
      }
      fail(e);
    },
  });

  if (detail.isLoading) return <p className="text-sm text-stone-500">Loading…</p>;
  if (detail.error || !detail.data)
    return (
      <div className="card">
        <p className="alert-error">Enquiry not found.</p>
        <Link href="/enquiries" className="btn-ghost mt-3 inline-flex text-sm">
          ← Enquiries
        </Link>
      </div>
    );
  const e = detail.data;
  const converted = e.status === "converted";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href="/enquiries" className="text-sm font-medium text-stone-500 hover:text-stone-800">
          ← Enquiries
        </Link>
        <h1 className="page-title">{e.name}</h1>
        <EnquiryStatusBadge status={e.status} />
        <span className="badge">{e.enquiryNo}</span>
        {!converted && (
          <button
            className="btn-primary ml-auto text-sm"
            onClick={() => setConvertOpen(!convertOpen)}
          >
            Convert to member…
          </button>
        )}
      </div>

      {msg && <p className={msgOk ? "alert-ok" : "alert-error"}>{msg}</p>}

      {convertOpen && !converted && (
        <div className="card border-brand-300">
          <h2 className="text-base font-semibold">Convert to member</h2>
          <p className="page-sub">
            Creates a real member from this lead — explicit and audited. The enquiry stays as
            history.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Gender *</label>
              <select
                className="input"
                value={genderId}
                onChange={(ev) => setGenderId(ev.target.value)}
              >
                <option value="">Select…</option>
                {genders.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                className="btn-primary text-sm"
                disabled={!genderId || convert.isPending}
                onClick={() => convert.mutate()}
              >
                {convert.isPending ? "Converting…" : "Confirm conversion"}
              </button>
            </div>
          </div>
          {dupe && dupe.length > 0 && (
            <div className="alert-warn mt-3">
              <p className="font-medium">A member with this phone already exists:</p>
              {dupe.map((d) => (
                <p key={d.id} className="text-sm">
                  <Link href={`/members/${d.id}`} className="link">
                    {d.memberCode} — {d.fullName}
                  </Link>
                </p>
              ))}
              <p className="mt-1 text-sm">Open the member instead — a lead converts only once.</p>
            </div>
          )}
        </div>
      )}

      {converted && e.convertedMember && (
        <div className="alert-ok">
          Converted to{" "}
          <Link href={`/members/${e.convertedMember.id}`} className="link">
            {e.convertedMember.memberCode} — {e.convertedMember.fullName}
          </Link>
          . Further edits are locked except notes.
        </div>
      )}

      <div className="card">
        <h2 className="text-base font-semibold">Details</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="section-title">Phone</p>
            <p className="text-sm tabular-nums">{e.phone}</p>
          </div>
          <div>
            <p className="section-title">Email</p>
            <p className="text-sm">{e.email ?? "—"}</p>
          </div>
          <div>
            <p className="section-title">Source</p>
            <p className="text-sm">{e.source ?? "—"}</p>
          </div>
          <div>
            <p className="section-title">Interest</p>
            <p className="text-sm">{e.interestPackage?.name ?? e.interest ?? "—"}</p>
          </div>
          <div>
            <p className="section-title">Enquiry date</p>
            <p className="text-sm tabular-nums">{e.enquiryDate.slice(0, 10)}</p>
          </div>
          <div>
            <p className="section-title">Next action</p>
            <p className="text-sm tabular-nums">
              {e.nextFollowUpAt ? e.nextFollowUpAt.slice(0, 16).replace("T", " ") : "—"}
            </p>
          </div>
        </div>
        {!converted && (
          <div className="mt-4 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-3">
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={e.status}
                onChange={(e2) => patch.mutate({ status: e2.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Assigned to</label>
              <select
                className="input"
                value={e.assignedTo?.id ?? ""}
                onChange={(e2) => patch.mutate({ assignedToId: e2.target.value || null })}
              >
                <option value="">Unassigned</option>
                {assignees.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Next action at</label>
              <input
                className="input"
                type="datetime-local"
                defaultValue={e.nextFollowUpAt ? e.nextFollowUpAt.slice(0, 16) : ""}
                onBlur={(e2) => {
                  if (e2.target.value)
                    patch.mutate({ nextFollowUpAt: new Date(e2.target.value).toISOString() });
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-base font-semibold">Follow-ups</h2>
        <ul className="mt-3 space-y-2">
          {e.followUps.map((f) => (
            <li
              key={f.id}
              className={`rounded-lg border p-3 text-sm ${f.doneAt ? "border-stone-200 bg-stone-50 opacity-75" : "border-brand-200 bg-orange-50/40"}`}
            >
              <div className="flex items-center gap-2">
                <span className="badge">{f.activity}</span>
                {f.dueAt && (
                  <span className="text-xs tabular-nums text-stone-500">
                    due {f.dueAt.slice(0, 16).replace("T", " ")}
                  </span>
                )}
                {f.doneAt && <span className="badge-green">done</span>}
                {!f.doneAt && !converted && (
                  <button
                    className="btn-ghost ml-auto px-2 py-0.5 text-xs"
                    onClick={() => doneFu.mutate(f.id)}
                  >
                    Mark done
                  </button>
                )}
              </div>
              {f.note && <p className="mt-1.5 text-stone-700">{f.note}</p>}
            </li>
          ))}
          {e.followUps.length === 0 && (
            <p className="text-sm text-stone-500">No follow-ups logged yet.</p>
          )}
        </ul>
        {!converted && (
          <form
            className="mt-4 grid gap-2 border-t border-stone-100 pt-4 sm:grid-cols-[130px_1fr_180px_auto]"
            onSubmit={(ev) => {
              ev.preventDefault();
              addFu.mutate();
            }}
          >
            <select
              className="input"
              value={fu.activity}
              onChange={(ev) => setFu({ ...fu, activity: ev.target.value })}
            >
              {ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={fu.note}
              onChange={(ev) => setFu({ ...fu, note: ev.target.value })}
              placeholder="Note…"
            />
            <input
              className="input"
              type="datetime-local"
              value={fu.dueAt}
              onChange={(ev) => setFu({ ...fu, dueAt: ev.target.value })}
            />
            <button className="btn-primary text-sm" type="submit" disabled={addFu.isPending}>
              Log
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
