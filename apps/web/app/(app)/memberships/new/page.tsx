"use client";

import { calcInvoice } from "@o2app/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ApiError, apiFetch } from "../../../../lib/api";
import { inr } from "../../../../components/memberships";

interface MemberOption {
  id: string;
  memberCode: string;
  fullName: string;
  mobile: string;
}

interface PkgOption {
  id: string;
  name: string;
  durationValue: number;
  durationUnit: string;
  durationDays: number;
  price: string;
  registrationFee: string;
  discountMaxPct: string | null;
  gstPercent: string | null;
}

const GST_DEFAULT = Number(process.env.NEXT_PUBLIC_GST_DEFAULT_PCT ?? 18);

export default function NewMembershipPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("memberId") ?? "";

  const [memberId, setMemberId] = useState(preselected);
  const [memberSearch, setMemberSearch] = useState("");
  const [packageId, setPackageId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [discountPct, setDiscountPct] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["member-pick", memberSearch],
    queryFn: () =>
      apiFetch<{ data: MemberOption[] }>(`/members?q=${encodeURIComponent(memberSearch)}&limit=8`),
    enabled: memberSearch.trim().length >= 2 && !memberId,
  });
  const packages = useQuery({
    queryKey: ["packages-sale"],
    queryFn: () => apiFetch<PkgOption[]>("/packages"),
  });

  const selectedMember = useQuery({
    queryKey: ["member-pick-one", memberId],
    queryFn: () => apiFetch<MemberOption>(`/members/${memberId}`),
    enabled: !!memberId,
  });

  const pkg = packages.data?.find((p) => p.id === packageId);

  const preview = useMemo(() => {
    if (!pkg) return null;
    const subtotal = Number(pkg.price) + Number(pkg.registrationFee);
    const discount = (subtotal * discountPct) / 100;
    const gstPercent = pkg.gstPercent !== null ? Number(pkg.gstPercent) : GST_DEFAULT;
    return { subtotal, discount, ...calcInvoice({ subtotal, discount, gstPercent }), gstPercent };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg?.id, discountPct, pkg?.price, pkg?.registrationFee, pkg?.gstPercent]);

  const maxDiscount =
    pkg?.discountMaxPct !== null && pkg?.discountMaxPct !== undefined
      ? Number(pkg.discountMaxPct)
      : 100;

  const sell = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>("/memberships", {
        method: "POST",
        body: JSON.stringify({
          memberId,
          packageId,
          startDate,
          discountPct,
          notes: notes || undefined,
          idempotencyKey:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
        }),
      }),
    onSuccess: (data) => router.replace(`/memberships/${data.id}`),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Sale failed — try again"),
  });

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="page-title">Sell membership</h1>
        <p className="page-sub">Member → package → dates → invoice, saved atomically.</p>
      </div>

      <div className="card">
        <h2 className="section-title">1 · Member</h2>
        {memberId && selectedMember.data ? (
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div>
              <p className="font-medium text-stone-900">{selectedMember.data.fullName}</p>
              <p className="text-xs text-stone-500">
                {selectedMember.data.memberCode} · {selectedMember.data.mobile}
              </p>
            </div>
            <button
              className="btn-ghost ml-auto px-2.5 py-1 text-xs"
              onClick={() => {
                setMemberId("");
                setMemberSearch("");
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <input
              className="input"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Type at least 2 letters of name, code or mobile…"
            />
            <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200">
              {members.data?.data.map((m) => (
                <li key={m.id}>
                  <button
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
                    onClick={() => {
                      setMemberId(m.id);
                      setMemberSearch("");
                    }}
                  >
                    <span className="font-medium text-stone-900">{m.fullName}</span>
                    <span className="text-xs text-stone-500">
                      {m.memberCode} · {m.mobile}
                    </span>
                  </button>
                </li>
              ))}
              {memberSearch.trim().length >= 2 && members.data?.data.length === 0 && (
                <li className="px-3 py-3 text-sm text-stone-500">
                  No match —{" "}
                  <Link href="/members/new" className="link">
                    register a new member first
                  </Link>
                  .
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">2 · Package & dates</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Package *</label>
            <select
              className="input"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            >
              <option value="">Select an active package…</option>
              {packages.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.durationValue} {p.durationUnit} · ₹
                  {Number(p.price).toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Start date *</label>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="hint">Future start dates are allowed.</p>
          </div>
          <div>
            <label className="label">Discount %</label>
            <input
              className="input"
              type="number"
              min={0}
              max={maxDiscount}
              step="0.5"
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
            />
            <p className="hint">Package allows up to {maxDiscount}%.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {preview && pkg && (
        <div className="card">
          <h2 className="section-title">3 · Payable</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Package + reg. fee</dt>
              <dd className="tabular-nums">{inr(preview.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Discount ({discountPct}%)</dt>
              <dd className="tabular-nums">− {inr(preview.discount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Taxable</dt>
              <dd className="tabular-nums">{inr(preview.taxable)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">GST ({preview.gstPercent}%)</dt>
              <dd className="tabular-nums">+ {inr(preview.gst)}</dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold">
              <dt>Total payable</dt>
              <dd className="tabular-nums text-brand-700">{inr(preview.total)}</dd>
            </div>
          </dl>
          <p className="hint mt-2">
            {pkg.durationDays}-day validity · invoice is created with the membership and stays
            unpaid until payment is recorded (Phase 5).
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={!memberId || !packageId || sell.isPending}
          onClick={() => {
            setError(null);
            sell.mutate();
          }}
        >
          {sell.isPending ? "Saving…" : "Confirm sale"}
        </button>
        <Link href="/memberships" className="btn-ghost">
          Cancel
        </Link>
      </div>
    </div>
  );
}
