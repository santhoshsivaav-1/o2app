"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "../../components/Logo";
import { NAV, NAV_GROUPS } from "../../lib/nav";
import { useAuth } from "../../lib/auth";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, has, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100">
        <div className="flex items-center gap-3 text-sm text-stone-500">
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600"
          />
          Loading your workspace…
        </div>
      </main>
    );
  }
  if (!user) {
    router.replace("/login");
    return null;
  }

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => !n.perm || has(n.perm)),
  })).filter((g) => g.items.length > 0);
  const visibleCount = groups.reduce((n, g) => n + g.items.length, 0);

  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-stone-200 px-4 py-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
        {visibleCount <= 2 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            Your account has almost no permissions, so most sections are hidden. Ask the gym owner
            to assign you a role (Staff → Edit).
          </div>
        )}
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={pathname === n.href ? "nav-link-active" : "nav-link"}
                    aria-current={pathname === n.href ? "page" : undefined}
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-stone-200 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200/70">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-900">{user.name}</p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
        </div>
        <button className="btn-ghost mt-2 w-full text-sm" onClick={() => logout()}>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-100 lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-stone-200 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-stone-950/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-stone-200 shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-6">
          <button
            className="btn-ghost px-2.5 py-1.5 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="text-[15px] font-semibold text-stone-900">
            {NAV.find((n) => n.href === pathname)?.label ?? "O2 Oxygen Fitness Studio"}
          </span>
          <span className="ml-auto hidden gap-1.5 sm:flex">
            {user.roles.map((r) => (
              <span key={r.id} className="badge">
                {r.name}
              </span>
            ))}
          </span>
        </header>
        <main className="mx-auto w-full max-w-6xl p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
