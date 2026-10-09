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

const err = "mt-1 text-xs text-red-300";

export default function MemberProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { has } = useAuth();
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
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

  // Seed the form once the member loads (and after archive/restore refreshes it).
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = member.data
    ? `${member.data.id}:${member.data.updatedAt ?? member.data.status}`
    : null;
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
      setMsg("Saved.");
      queryClient.invalidateQueries({ queryKey: ["member", id] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : "Save failed"),
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

  if (member.isLoading) return <p className="text-sm text-stone-500">Loading…</p>;
  if (member.error)
    return (
      <div className="card">
        <p className="text-sm text-red-300">
          {member.error instanceof ApiError ? member.error.message : "Failed to load member"}
        </p>
        <Link href="/members" className="btn-ghost mt-3 inline-flex text-sm">
          ← Members
        </Link>
      </div>
    );

  const m = member.data!;
  const archived = m.status === "archived";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/members" className="text-sm text-stone-400 hover:text-stone-200">
          ← Members
        </Link>
        <h1 className="text-lg font-semibold">{m.fullName}</h1>
        <span className="badge">{m.memberCode}</span>
        <span className="badge">{m.status}</span>
        {has("members.archive") && (
          <button
            className="btn-ghost ml-auto px-2 py-1 text-xs"
            onClick={() => archive.mutate(archived ? "restore" : "archive")}
          >
            {archived ? "Restore" : "Archive"}
          </button>
        )}
      </div>

      {has("members.update") ? (
        <form
          className="card grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((v) => save.mutate(v))}
        >
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
            <label className="label">Source</label>
            <input className="input" {...register("source")} />
          </div>
          <div>
            <label className="label">Device user ID</label>
            <input className="input" {...register("deviceUserId")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} {...register("notes")} />
          </div>
          {msg && <p className="text-sm text-stone-300 sm:col-span-2">{msg}</p>}
          <div className="sm:col-span-2">
            <button className="btn-primary" type="submit" disabled={isSubmitting || save.isPending}>
              Save changes
            </button>
          </div>
        </form>
      ) : (
        <div className="card text-sm text-stone-300">
          {m.mobile} · {m.gender.name} · registered {m.registrationDate.slice(0, 10)}
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="font-medium">Follow-up notes</h2>
        {m.memberNotes.map((n) => (
          <div key={n.id} className="rounded-lg border border-stone-800 p-3 text-sm">
            <p>{n.body}</p>
            <p className="mt-1 text-xs text-stone-500">
              {n.createdAt.slice(0, 16).replace("T", " ")}
            </p>
          </div>
        ))}
        {m.memberNotes.length === 0 && <p className="text-sm text-stone-500">No notes yet.</p>}
        {has("members.update") && (
          <form
            className="flex gap-2"
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
        <h2 className="font-medium">History</h2>
        <p className="mt-1 text-sm text-stone-500">
          Memberships, payments and attendance history appear here in Phases 4, 5 and 7 — every
          record is preserved and linked to this profile.
        </p>
      </div>
    </div>
  );
}
