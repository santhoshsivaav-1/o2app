"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { memberSchema } from "@o2app/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ApiError, apiFetch } from "../../../../lib/api";

type FormValues = z.infer<typeof memberSchema>;

interface DupeMatch {
  id: string;
  memberCode: string;
  fullName: string;
  mobile: string;
}

const err = "mt-1 text-xs text-red-300";

export default function NewMemberPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const genders = useQuery({
    queryKey: ["genders"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/genders"),
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [dupe, setDupe] = useState<DupeMatch[] | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(memberSchema) });

  async function post(values: FormValues & { confirmDuplicate?: boolean }) {
    const data = await apiFetch<{ id: string }>("/members", {
      method: "POST",
      body: JSON.stringify(values),
    });
    queryClient.invalidateQueries({ queryKey: ["members"] });
    router.replace(`/members/${data.id}`);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setDupe(null);
    try {
      await post(values);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const details = e.details as { matches?: DupeMatch[] } | null;
        setDupe(details?.matches ?? []);
        setServerError(
          "Possible duplicate — same mobile already registered. Confirm below to proceed.",
        );
      } else {
        setServerError(e instanceof ApiError ? e.message : "Registration failed");
      }
    }
  }

  async function confirmAnyway() {
    try {
      await post({ ...getValues(), confirmDuplicate: true });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Registration failed");
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold">New member registration</h1>
      <form className="card grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="label">Full name *</label>
          <input className="input" {...register("fullName")} />
          {errors.fullName && <p className={err}>{errors.fullName.message}</p>}
        </div>
        <div>
          <label className="label">Mobile *</label>
          <input className="input" {...register("mobile")} placeholder="+91 …" />
          {errors.mobile && <p className={err}>{errors.mobile.message}</p>}
        </div>
        <div>
          <label className="label">Gender *</label>
          <select className="input" {...register("genderId")} defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {genders.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {errors.genderId && <p className={err}>{errors.genderId.message}</p>}
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" {...register("email")} />
          {errors.email && <p className={err}>{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Date of birth</label>
          <input className="input" type="date" {...register("dob")} />
          {errors.dob && <p className={err}>{errors.dob.message}</p>}
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
          <label className="label">Source (walk-in, referral…)</label>
          <input className="input" {...register("source")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={3} {...register("notes")} />
        </div>
        {serverError && (
          <p
            role="alert"
            className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300 sm:col-span-2"
          >
            {serverError}
          </p>
        )}
        {dupe && dupe.length > 0 && (
          <div className="space-y-2 rounded-lg border border-amber-800 bg-amber-950/40 p-3 sm:col-span-2">
            <p className="text-sm text-amber-200">Existing member(s) with this mobile:</p>
            {dupe.map((d) => (
              <p key={d.id} className="text-sm">
                <Link href={`/members/${d.id}`} className="text-brand-300 hover:underline">
                  {d.memberCode} — {d.fullName} ({d.mobile})
                </Link>
              </p>
            ))}
            <button type="button" className="btn-ghost text-sm" onClick={confirmAnyway}>
              Register anyway (audited)
            </button>
          </div>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registering…" : "Register member"}
          </button>
          <Link href="/members" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
