"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { NAV } from "../../lib/nav";

function Stat({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  loading?: boolean;
}) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-stone-900">
        {loading ? <span className="text-stone-300">…</span> : value}
      </p>
      <p className="mt-1 text-xs text-stone-500">{sub}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, has } = useAuth();

  const health = useQuery({
    queryKey: ["api-health"],
    queryFn: () => apiFetch<{ ok: boolean; db: string }>("/health/ready"),
    retry: false,
  });
  const members = useQuery({
    queryKey: ["members-count"],
    queryFn: () => apiFetch<{ meta: { total: number } }>("/members?limit=1"),
    retry: false,
    enabled: has("members.read"),
  });
  const staff = useQuery({
    queryKey: ["staff-count"],
    queryFn: () => apiFetch<unknown[]>("/users"),
    retry: false,
    enabled: has("staff.manage"),
  });

  const shortcuts = NAV.filter((n) => n.href !== "/" && (!n.perm || has(n.perm)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Good to see you, {user?.name?.split(" ")[0]}.</h1>
        <p className="page-sub">
          Here&apos;s what&apos;s happening at O2 Oxygen Fitness Studio today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Members"
          value={members.data ? String(members.data.meta.total) : "—"}
          sub="Registered in the system"
          loading={members.isLoading}
        />
        <Stat
          label="Staff accounts"
          value={staff.data ? String(staff.data.length) : has("staff.manage") ? "—" : "–"}
          sub={has("staff.manage") ? "Active and disabled" : "Restricted to managers"}
          loading={staff.isLoading}
        />
        <Stat
          label="API status"
          value={health.data ? "Online" : "…"}
          sub={health.data ? `Database ${health.data.db}` : "Checking connection"}
          loading={health.isLoading}
        />
        <Stat
          label="Your access"
          value={String(user?.permissions.length ?? 0)}
          sub={`${user?.roles.map((r) => r.name).join(", ") ?? ""}`}
        />
      </div>

      <div>
        <h2 className="section-title mb-3">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="card group transition hover:border-brand-300 hover:shadow"
            >
              <p className="font-semibold text-stone-900 group-hover:text-brand-700">{n.label}</p>
              <p className="mt-1 text-sm text-stone-500">Open {n.label.toLowerCase()} →</p>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-xs text-stone-400">
        Analytics, collections and attendance trends arrive with the dashboard phase — every number
        above is read live from the database.
      </p>
    </div>
  );
}
