"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { NAV } from "../../lib/nav";

export default function DashboardPage() {
  const { user, has } = useAuth();
  const health = useQuery({
    queryKey: ["api-health"],
    queryFn: () => apiFetch<{ ok: boolean; db: string }>("/health/ready"),
    retry: false,
  });

  const shortcuts = NAV.filter((n) => n.href !== "/" && (!n.perm || has(n.perm))).slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="card">
        <h1 className="text-xl font-semibold">Namaste, {user?.name} 💪</h1>
        <p className="mt-1 text-sm text-stone-400">
          O2 Oxygen Fitness Studio — staff console (Phase 2 shell; member, billing and attendance
          modules land in Phases 3–7).
        </p>
        <p className="mt-2 text-xs text-stone-500">
          API: {health.data ? `connected (db ${health.data.db})` : "checking…"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((n) => (
          <Link key={n.href} href={n.href} className="card hover:border-brand-600/60">
            <p className="font-medium text-brand-300">{n.label}</p>
            <p className="mt-1 text-sm text-stone-500">Open {n.label.toLowerCase()} →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
