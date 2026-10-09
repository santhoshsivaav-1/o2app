"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../../lib/api";

export default function NewEnquiryPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    interest: "",
    interestPackageId: "",
    source: "",
    enquiryDate: "",
    assignedToId: "",
    status: "new",
    nextFollowUpAt: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const packages = useQuery({
    queryKey: ["packages-sale"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/packages"),
  });
  const assignees = useQuery({
    queryKey: ["assignees"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/enquiries/assignees"),
  });
  const sources = useQuery({
    queryKey: ["enquiry-sources"],
    queryFn: () => apiFetch<{ source: string }[]>("/enquiries/sources"),
  });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
      };
      for (const k of [
        "email",
        "interest",
        "interestPackageId",
        "source",
        "enquiryDate",
        "assignedToId",
        "status",
        "notes",
      ] as const) {
        if (form[k]) body[k] = form[k];
      }
      if (form.nextFollowUpAt) body.nextFollowUpAt = new Date(form.nextFollowUpAt).toISOString();
      return apiFetch<{ id: string }>("/enquiries", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (d) => router.replace(`/enquiries/${d.id}`),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed"),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="page-title">New enquiry</h1>
        <p className="page-sub">Log the lead now — assign and schedule the first follow-up.</p>
      </div>
      <form
        className="card grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          create.mutate();
        }}
      >
        <div>
          <label className="label">Prospect name *</label>
          <input
            className="input"
            required
            value={form.name}
            onChange={set("name")}
            placeholder="Rahul Verma"
          />
        </div>
        <div>
          <label className="label">Phone *</label>
          <input
            className="input"
            required
            value={form.phone}
            onChange={set("phone")}
            placeholder="+91 …"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label className="label">Lead source</label>
          <input
            className="input"
            value={form.source}
            onChange={set("source")}
            list="lead-sources"
            placeholder="Walk-in, Instagram…"
          />
          <datalist id="lead-sources">
            {sources.data?.map((s) => (
              <option key={s.source} value={s.source} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">Interested package</label>
          <select
            className="input"
            value={form.interestPackageId}
            onChange={set("interestPackageId")}
          >
            <option value="">—</option>
            {packages.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Interest note</label>
          <input
            className="input"
            value={form.interest}
            onChange={set("interest")}
            placeholder="e.g. Evening batch"
          />
        </div>
        <div>
          <label className="label">Assign to</label>
          <select className="input" value={form.assignedToId} onChange={set("assignedToId")}>
            <option value="">Unassigned</option>
            {assignees.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={set("status")}>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="follow_up">Follow-up required</option>
            <option value="trial">Trial scheduled</option>
            <option value="interested">Interested</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <div>
          <label className="label">Enquiry date</label>
          <input
            className="input"
            type="date"
            value={form.enquiryDate}
            onChange={set("enquiryDate")}
          />
          <p className="hint">Defaults to today.</p>
        </div>
        <div>
          <label className="label">Next follow-up</label>
          <input
            className="input"
            type="datetime-local"
            value={form.nextFollowUpAt}
            onChange={set("nextFollowUpAt")}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
        </div>
        {error && (
          <p role="alert" className="alert-error sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2 border-t border-stone-100 pt-4">
          <button className="btn-primary" type="submit" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save enquiry"}
          </button>
          <Link href="/enquiries" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
