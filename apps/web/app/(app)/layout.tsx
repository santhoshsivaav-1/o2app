"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "../../components/Logo";
import { NAV } from "../../lib/nav";
import { useAuth } from "../../lib/auth";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, has, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-stone-400">Loading…</p>
      </main>
    );
  }
  if (!user) {
    router.replace("/login");
    return null;
  }

  const items = NAV.filter((n) => !n.perm || has(n.perm));
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-800 p-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-2 text-sm ${
              pathname === n.href
                ? "bg-brand-600/15 font-medium text-brand-300"
                : "text-stone-300 hover:bg-stone-800/60"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-stone-800 p-4 text-sm">
        <p className="font-medium">{user.name}</p>
        <p className="truncate text-xs text-stone-500">{user.email}</p>
        <button className="btn-ghost mt-3 w-full text-sm" onClick={() => logout()}>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-stone-800 bg-coal-900 lg:block">
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-coal-900">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-stone-800 bg-coal-900/60 px-4 py-3 lg:px-6">
          <button
            className="btn-ghost px-3 py-1.5 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="font-medium">
            {items.find((n) => n.href === pathname)?.label ?? "O2 Oxygen Fitness Studio"}
          </span>
          <span className="ml-auto hidden gap-2 sm:flex">
            {user.roles.map((r) => (
              <span key={r.id} className="badge">
                {r.name}
              </span>
            ))}
          </span>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
