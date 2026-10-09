"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { memberSchema } from "@o2app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ApiError, apiFetch } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth";
import {
  ValidityBadge,
  dateOnly,
  inr,
  type MembershipRow,
} from "../../../../components/memberships";

type FormValues = z.infer<typeof memberSchema>;

interface Member {
  id: string;
  memberCode: string;
  fullName: string;
  mobile: string;
  email: string | null;
  dob: string | null;
  address: string | null;
  emergencyContact: string | null;
  registrationDate: string;
  photoUrl: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  deviceUserId: string | null;
  updatedAt: string;
  gender: { id: string; name: string };
  assignedTrainer: { id: string; name: string } | null;
  memberNotes: { id: string; body: string; createdAt: string }[];
}

const err = "field-err";

function MembershipHistory({ memberId }: { memberId: string }) {
  const history = useQuery({
    queryKey: ["member-memberships", memberId],
    queryFn: () =>
      apiFetch<{ data: MembershipRow[] }>(
        `/memberships?memberId=${memberId}&limit=20&sort=startDate&order=desc`,
      ),
  });
  if (history.isLoading) return <p className="mt-2 text-sm text-stone-500">Loading…</p>;
  if (!history.data || history.data.data.length === 0)
    return <p className="mt-2 text-sm text-stone-500">No memberships yet.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {history.data.data.map((ms) => (
        <li
          key={ms.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
        >
          <Link
            href={`/memberships/${ms.id}`}
            className="font-medium text-stone-900 hover:text-brand-700"
          >
            {ms.package.name}
          </Link>
          <span className="text-xs tabular-nums text-stone-500">
            {dateOnly(ms.startDate)} → {dateOnly(ms.endDate)}
          </span>
          <span className="text-xs font-medium tabular-nums text-stone-700">{inr(ms.total)}</span>
          <span className="ml-auto">
            <ValidityBadge validity={ms.validity} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <span className="badge-green">Active</span>;
  if (status === "inactive") return <span className="badge-amber">Inactive</span>;
  return <span className="badge">Archived</span>;
}

export default function MemberProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { has } = useAuth();
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);
  const [note, setNote] = useState("");

  const member = useQuery({
    queryKey: ["member", id],
    queryFn: () => apiFetch<Member>(`/members/${id}`),
  });
  const genders = useQuery({
    queryKey: ["genders"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/genders"),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(memberSchema) });

  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = member.data ? `${member.data.id}:${member.data.updatedAt}` : null;
  useEffect(() => {
    if (member.data && seededFor !== seedKey) {
      const m = member.data;
      reset({
        fullName: m.fullName,
        mobile: m.mobile,
        email: m.email ?? "",
        genderId: m.gender.id,
        dob: m.dob ? m.dob.slice(0, 10) : "",
        address: m.address ?? "",
        emergencyContact: m.emergencyContact ?? "",
        registrationDate: m.registrationDate.slice(0, 10),
        notes: m.notes ?? "",
        source: m.source ?? "",
        deviceUserId: m.deviceUserId ?? "",
      } as FormValues);
      setSeededFor(seedKey);
    }
  }, [member.data, seededFor, seedKey, reset]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      apiFetch(`/members/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: () => {
      setMsgOk(true);
      setMsg("Saved.");
      queryClient.invalidateQueries({ queryKey: ["member", id] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => {
      setMsgOk(false);
      setMsg(e instanceof ApiError ? e.message : "Save failed");
    },
  });

  const addNote = useMutation({
    mutationFn: () =>
      apiFetch(`/members/${id}/notes`, { method: "POST", body: JSON.stringify({ body: note }) }),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["member", id] });
    },
  });

  const archive = useMutation({
    mutationFn: (action: "archive" | "restore") =>
      apiFetch(`/members/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member", id] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  if (member.isLoading) return <p className="text-sm text-stone-500">Loading member…</p>;
  if (member.error)
    return (
      <div>
        <h1 className="page-title">Member</h1>
        <div className="card mt-4">
          <p className="alert-error">
            {member.error instanceof ApiError ? member.error.message : "Failed to load member"}
          </p>
          <Link href="/members" className="btn-ghost mt-3 inline-flex text-sm">
            ← Members
          </Link>
        </div>
      </div>
    );

  const m = member.data!;
  const archived = m.status === "archived";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href="/members" className="text-sm font-medium text-stone-500 hover:text-stone-800">
          ← Members
        </Link>
        <h1 className="page-title">{m.fullName}</h1>
        <span className="badge-blue">{m.memberCode}</span>
        <StatusBadge status={m.status} />
        {has("members.archive") && (
          <button
            className={archived ? "btn-ghost ml-auto text-sm" : "btn-danger ml-auto text-sm"}
            onClick={() => archive.mutate(archived ? "restore" : "archive")}
            disabled={archive.isPending}
          >
            {archived ? "Restore member" : "Archive member"}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card !p-4">
          <p className="section-title">Mobile</p>
          <p className="mt-1 text-sm font-medium tabular-nums text-stone-900">{m.mobile}</p>
        </div>
        <div className="card !p-4">
          <p className="section-title">Registered</p>
          <p className="mt-1 text-sm font-medium text-stone-900">
            {m.registrationDate.slice(0, 10)}
          </p>
        </div>
        <div className="card !p-4">
          <p className="section-title">Trainer</p>
          <p className="mt-1 text-sm font-medium text-stone-900">
            {m.assignedTrainer?.name ?? "—"}
          </p>
        </div>
      </div>

      {has("members.update") ? (
        <form className="card" onSubmit={handleSubmit((v) => save.mutate(v))}>
          <h2 className="text-base font-semibold text-stone-900">Edit details</h2>
          <p className="page-sub">Every change is saved against this profile and audited.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name *</label>
              <input className="input" {...register("fullName")} />
              {errors.fullName && <p className={err}>{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="label">Mobile *</label>
              <input className="input" {...register("mobile")} />
              {errors.mobile && <p className={err}>{errors.mobile.message}</p>}
            </div>
            <div>
              <label className="label">Gender *</label>
              <select className="input" {...register("genderId")}>
                {genders.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" {...register("email")} />
            </div>
            <div>
              <label className="label">Date of birth</label>
              <input className="input" type="date" {...register("dob")} />
            </div>
            <div>
              <label className="label">Registration date</label>
              <input className="input" type="date" {...register("registrationDate")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <input className="input" {...register("address")} />
            </div>
            <div>
              <label className="label">Emergency contact</label>
              <input className="input" {...register("emergencyContact")} />
            </div>
            <div>
              <label className="label">Device user ID</label>
              <input
                className="input"
                {...register("deviceUserId")}
                placeholder="Fingerprint device mapping"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} {...register("notes")} />
            </div>
          </div>
          {msg && <p className={msgOk ? "alert-ok mt-4" : "alert-error mt-4"}>{msg}</p>}
          <button
            className="btn-primary mt-4"
            type="submit"
            disabled={isSubmitting || save.isPending}
          >
            Save changes
          </button>
        </form>
      ) : (
        <div className="card text-sm text-stone-600">
          {m.mobile} · {m.gender.name} · registered {m.registrationDate.slice(0, 10)}
        </div>
      )}

      <div className="card">
        <h2 className="text-base font-semibold text-stone-900">Follow-up notes</h2>
        <p className="page-sub">Dated history — newest first.</p>
        <div className="mt-3 space-y-2.5">
          {m.memberNotes.map((n) => (
            <div key={n.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="text-stone-800">{n.body}</p>
              <p className="mt-1 text-xs tabular-nums text-stone-400">
                {n.createdAt.slice(0, 16).replace("T", " ")}
              </p>
            </div>
          ))}
          {m.memberNotes.length === 0 && (
            <p className="text-sm text-stone-500">No notes yet — add the first follow-up below.</p>
          )}
        </div>
        {has("members.update") && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim()) addNote.mutate();
            }}
          >
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a dated follow-up note…"
            />
            <button className="btn-primary shrink-0" type="submit" disabled={addNote.isPending}>
              Add
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-stone-900">Memberships</h2>
          {has("memberships.create") && (
            <Link
              href={`/memberships/new?memberId=${m.id}`}
              className="btn-primary ml-auto px-2.5 py-1 text-xs"
            >
              + New membership
            </Link>
          )}
        </div>
        <MembershipHistory memberId={m.id} />
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-stone-900">Payments & attendance</h2>
        <p className="mt-1 text-sm text-stone-500">
          Payment history arrives with Phase 5 billing and attendance history with Phase 7 — both
          link back to this profile.
        </p>
      </div>
    </div>
  );
}
