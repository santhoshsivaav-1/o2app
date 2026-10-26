"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  EMERGENCY_RELATIONSHIPS,
  diffDays,
  emergencyRelationshipLabel,
  memberSchema,
  membershipValidity,
  ptEndDate,
} from "@o2app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ApiError, apiFetch, downloadFile } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth";
import {
  ValidityBadge,
  dateOnly,
  inr,
  type MembershipRow,
} from "../../../../components/memberships";
import { MemberPhoto } from "../../../../components/MemberPhoto";
import { InvoiceStatusBadge } from "../../../../components/billing";
import { SourceBadge } from "../../../../components/attendance";

interface AttendanceRow {
  id: string;
  date: string;
  checkInAt: string;
  source: string;
}

function MemberAttendance({ memberId }: { memberId: string }) {
  const { has } = useAuth();
  const history = useQuery({
    queryKey: ["member-attendance", memberId],
    queryFn: () =>
      apiFetch<{ records: AttendanceRow[]; validity: string }>(`/attendance/by-member/${memberId}`),
    enabled: has("attendance.read"),
  });
  if (!has("attendance.read"))
    return (
      <p className="mt-2 text-sm text-stone-500">Attendance is restricted to permitted staff.</p>
    );
  if (history.isLoading) return <p className="mt-2 text-sm text-stone-500">Loading…</p>;
  const rows = history.data?.records ?? [];
  return (
    <div className="mt-2">
      <p className="text-xs text-stone-500">
        Membership validity now:{" "}
        <span className="font-medium text-stone-700">{history.data?.validity ?? "—"}</span>
        {" · "}
        {rows.length} check-ins on record
      </p>
      {rows.length > 0 && (
        <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
          {rows.slice(0, 30).map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm"
            >
              <span className="font-medium tabular-nums">{a.date.slice(0, 10)}</span>
              <span className="text-xs tabular-nums text-stone-500">
                {a.checkInAt.slice(11, 16)}
              </span>
              <span className="ml-auto">
                <SourceBadge source={a.source} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface MemberInvoice {
  id: string;
  invoiceNo: string;
  total: string;
  paid: number;
  outstanding: number;
  status: string;
}

function MemberInvoices({ memberId }: { memberId: string }) {
  const { has } = useAuth();
  const list = useQuery({
    queryKey: ["member-invoices", memberId],
    queryFn: () => apiFetch<{ data: MemberInvoice[] }>(`/invoices?memberId=${memberId}&limit=20`),
    enabled: has("payments.collect"),
  });
  if (!has("payments.collect"))
    return (
      <p className="mt-2 text-sm text-stone-500">
        Financial records are restricted to front-desk staff.
      </p>
    );
  if (list.isLoading) return <p className="mt-2 text-sm text-stone-500">Loading…</p>;
  if (!list.data || list.data.data.length === 0)
    return <p className="mt-2 text-sm text-stone-500">No invoices yet.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {list.data.data.map((inv) => (
        <li
          key={inv.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
        >
          <Link
            href={`/billing/invoices/${inv.id}`}
            className="font-medium text-stone-900 hover:text-brand-700"
          >
            {inv.invoiceNo}
          </Link>
          <span className="text-xs tabular-nums text-stone-500">
            {inr(inv.total)} · paid {inr(inv.paid)}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium tabular-nums">due {inr(inv.outstanding)}</span>
            <InvoiceStatusBadge status={inv.status} />
            <button
              className="btn-ghost px-2 py-0.5 text-xs"
              onClick={() =>
                downloadFile(`/invoices/${inv.id}/pdf`, `${inv.invoiceNo}.pdf`).catch((e) =>
                  window.alert(e instanceof Error ? e.message : "PDF download failed"),
                )
              }
            >
              PDF
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

type FormValues = z.infer<typeof memberSchema>;

interface Member {
  id: string;
  memberCode: string;
  fullName: string;
  mobile: string;
  email: string | null;
  dob: string | null;
  address: string | null;
  emergName: string | null;
  emergMobile: string | null;
  emergAddress: string | null;
  emergRelationship: string | null;
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
  memberships?: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    total: string;
    ptTotal: string;
    ptDurationMonths: number | null;
    ptStart: string | null;
    ptTrainer: { id: string; name: string } | null;
    package: { id: string; name: string };
  }[];
  payments?: {
    id: string;
    type: string;
    method: string;
    amount: string;
    paidAt: string;
    reference: string | null;
  }[];
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

/** Latest plan + PT progress, mirroring the reference app's member-details modal. */
function PlanCard({
  current,
  ptPaid,
  ptEnd,
}: {
  current: NonNullable<Member["memberships"]>[number];
  ptPaid: number;
  ptEnd: string | null;
}) {
  const start = current.startDate.slice(0, 10);
  const end = current.endDate.slice(0, 10);
  const validity = membershipValidity(
    start,
    end,
    new Date().toISOString().slice(0, 10),
    current.status as "active" | "suspended" | "cancelled",
  );
  const daysLeft = diffDays(new Date().toISOString().slice(0, 10), end);
  const ptTotal = Number(current.ptTotal ?? 0);
  const hasPt = ptTotal > 0;
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-stone-900">Current plan</h2>
        <span className="badge">{current.package.name}</span>
        <span className="ml-auto">
          <ValidityBadge validity={validity} />
          {validity === "active" && (
            <span className="ml-2 text-xs text-stone-500">
              {daysLeft >= 0 ? `${daysLeft} day(s) remaining` : `expired ${Math.abs(daysLeft)} day(s) ago`}
            </span>
          )}
        </span>
      </div>
      <p className="mt-2 text-sm tabular-nums text-stone-500">
        {dateOnly(current.startDate)} → {dateOnly(current.endDate)} · plan {inr(current.total)}
      </p>
      <Link href={`/memberships/${current.id}`} className="link mt-1 inline-block text-sm">
        Open membership →
      </Link>
      {hasPt && (
        <div className="mt-3 rounded-lg border border-stone-200 bg-brand-50/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Personal training
          </p>
          <div className="mt-1.5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <p>
              <span className="text-stone-500">Trainer </span>
              <span className="font-medium">{current.ptTrainer?.name ?? "—"}</span>
            </p>
            <p>
              <span className="text-stone-500">Duration </span>
              <span className="font-medium">{current.ptDurationMonths ?? "—"} month(s)</span>
            </p>
            <p>
              <span className="text-stone-500">Period </span>
              <span className="tabular-nums">
                {current.ptStart ? dateOnly(current.ptStart) : "—"} → {ptEnd ? dateOnly(ptEnd) : "—"}
              </span>
            </p>
            <p>
              <span className="text-stone-500">Paid </span>
              <span className="tabular-nums">{inr(ptPaid)}</span>
              <span className="text-stone-500"> of {inr(ptTotal)}</span>
              <span className="ml-2 font-medium tabular-nums">
                {inr(Math.max(0, ptTotal - ptPaid))} due
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
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
  const [photoPad, setPhotoPad] = useState<string>("");
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEnlargedPhoto(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    if (member.data && seededFor !== seedKey) {
      const m = member.data;
      setPhotoPad(m.photoUrl ?? "");
      reset({
        fullName: m.fullName,
        mobile: m.mobile,
        email: m.email ?? "",
        genderId: m.gender.id,
        dob: m.dob ? m.dob.slice(0, 10) : "",
        address: m.address ?? "",
        emergName: m.emergName ?? "",
        emergMobile: m.emergMobile ?? "",
        emergAddress: m.emergAddress ?? "",
        emergRelationship: m.emergRelationship ?? "",
        assignedTrainerId: m.assignedTrainer?.id ?? "",
        registrationDate: m.registrationDate.slice(0, 10),
        notes: m.notes ?? "",
        source: m.source ?? "",
        deviceUserId: m.deviceUserId ?? "",
      } as FormValues);
      setSeededFor(seedKey);
    }
  }, [member.data, seededFor, seedKey, reset]);

  const trainers = useQuery({
    queryKey: ["trainer-options"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/members/trainer-options"),
    enabled: has("members.update"),
  });

  const photoSave = useMutation({
    mutationFn: (photoUrl: string) =>
      apiFetch(`/members/${id}/photo`, { method: "POST", body: JSON.stringify({ photoUrl }) }),
    onSuccess: () => {
      setMsgOk(true);
      setMsg("Photo updated.");
      queryClient.invalidateQueries({ queryKey: ["member", id] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => {
      setMsgOk(false);
      setMsg(e instanceof ApiError ? e.message : "Photo update failed");
    },
  });

  const profilePdf = useMutation({
    mutationFn: () => downloadFile(`/members/${id}/pdf`, `${member.data?.memberCode ?? "member"}-profile.pdf`),
    onError: (e) => window.alert(e instanceof Error ? e.message : "PDF download failed"),
  });

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
  const current = m.memberships?.[0];
  const ptEnd = current
    ? ptEndDate(current.ptStart ? current.ptStart.slice(0, 10) : null, current.ptDurationMonths)
    : null;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href="/members" className="text-sm font-medium text-stone-500 hover:text-stone-800">
          ← Members
        </Link>
        {m.photoUrl && (
          <button
            type="button"
            onClick={() => setEnlargedPhoto(m.photoUrl)}
            className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-stone-200 transition hover:ring-2 hover:ring-brand-500 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            title="Click to view full photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.photoUrl}
              alt={m.fullName}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          </button>
        )}
        <h1 className="page-title">{m.fullName}</h1>
        <span className="badge-blue">{m.memberCode}</span>
        <StatusBadge status={m.status} />
        <span className="ml-auto flex gap-2">
          <button
            className="btn-ghost text-sm"
            onClick={() => profilePdf.mutate()}
            disabled={profilePdf.isPending}
          >
            {profilePdf.isPending ? "Preparing…" : "Profile PDF"}
          </button>
          {has("members.archive") && (
            <button
              className={archived ? "btn-ghost text-sm" : "btn-danger text-sm"}
              onClick={() => archive.mutate(archived ? "restore" : "archive")}
              disabled={archive.isPending}
            >
              {archived ? "Restore member" : "Archive member"}
            </button>
          )}
        </span>
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

      {current && (
        <PlanCard
          current={current}
          ptPaid={m.payments?.reduce((n, p) => (p.type === "pt" ? n + Number(p.amount) : n), 0) ?? 0}
          ptEnd={ptEnd}
        />
      )}

      <div className="card">
        <h2 className="text-base font-semibold text-stone-900">Emergency contact</h2>
        {m.emergName || m.emergMobile ? (
          <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-stone-500">Name </span>
              <span className="font-medium">{m.emergName}</span>
              {m.emergRelationship && (
                <span className="text-stone-500">
                  {" "}
                  · {emergencyRelationshipLabel(m.emergRelationship)}
                </span>
              )}
            </p>
            <p>
              <span className="text-stone-500">Mobile </span>
              <span className="font-medium tabular-nums">{m.emergMobile ?? "—"}</span>
            </p>
            {m.emergAddress && (
              <p className="sm:col-span-2">
                <span className="text-stone-500">Address </span>
                <span>{m.emergAddress}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-stone-500">Not recorded yet.</p>
        )}
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
              <label className="label">Trainer</label>
              <select className="input" {...register("assignedTrainerId")} defaultValue="">
                <option value="">None assigned</option>
                {trainers.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
              <MemberPhoto
                value={photoPad}
                onChange={(v) => {
                  setPhotoPad(v);
                  photoSave.mutate(v);
                }}
                onEnlarge={(v) => setEnlargedPhoto(v)}
                disabled={photoSave.isPending}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} {...register("notes")} />
            </div>
          </div>

          <h3 className="section-title mt-6">Emergency contact</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input className="input" {...register("emergName")} />
              {errors.emergName && <p className={err}>{errors.emergName.message}</p>}
            </div>
            <div>
              <label className="label">Relationship</label>
              <select className="input" {...register("emergRelationship")} defaultValue="">
                <option value="">Select…</option>
                {EMERGENCY_RELATIONSHIPS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              {errors.emergRelationship && <p className={err}>{errors.emergRelationship.message}</p>}
            </div>
            <div>
              <label className="label">Mobile</label>
              <input className="input" {...register("emergMobile")} />
              {errors.emergMobile && <p className={err}>{errors.emergMobile.message}</p>}
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" {...register("emergAddress")} />
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
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-stone-900">Invoices & payments</h2>
          {has("payments.collect") && (
            <Link
              href={`/billing?memberId=${m.id}`}
              className="btn-primary ml-auto px-2.5 py-1 text-xs"
            >
              + Record payment
            </Link>
          )}
        </div>
        <MemberInvoices memberId={m.id} />
      </div>

      <div className="card">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-stone-900">Attendance</h2>
          {has("attendance.correct") && (
            <Link href="/attendance" className="btn-ghost ml-auto px-2.5 py-1 text-xs">
              Open attendance →
            </Link>
          )}
        </div>
        <MemberAttendance memberId={m.id} />
      </div>

      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setEnlargedPhoto(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex max-h-[90vh] max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-4 py-3">
              <div>
                <h3 className="font-semibold text-stone-900">{m.fullName}</h3>
                <p className="text-xs text-stone-500">{m.memberCode}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition focus:outline-none"
                onClick={() => setEnlargedPhoto(null)}
                aria-label="Close photo"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-center bg-stone-950 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enlargedPhoto}
                alt={m.fullName}
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
              />
            </div>
            <div className="border-t border-stone-100 bg-white px-4 py-2.5 text-right">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setEnlargedPhoto(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
