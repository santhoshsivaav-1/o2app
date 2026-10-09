"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "../../components/Logo";
import { useAuth } from "../../lib/auth";

const HIGHLIGHTS = [
  { title: "Members & memberships", body: "Registration, renewals and validity in one place." },
  { title: "Billing with GST", body: "Invoices, partial payments and receipts that reconcile." },
  {
    title: "Attendance & reports",
    body: "Device check-ins, expiry reminders and daily operations.",
  },
];

export default function LoginPage() {
  const { login, loginError, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isLoading && user) {
    router.replace("/");
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-stone-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 320px at 20% 15%, rgba(249,115,22,0.22), transparent 60%), radial-gradient(500px 300px at 85% 90%, rgba(249,115,22,0.12), transparent 60%)",
          }}
        />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
            Staff console
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
            Run your studio like a pro.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-400">
            One console for the front desk — members, packages, billing and attendance, backed by
            real records and strict staff permissions.
          </p>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div>
                  <p className="text-sm font-semibold text-white">{h.title}</p>
                  <p className="text-sm text-stone-400">{h.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-stone-500">
          O2 Oxygen Fitness Studio · internal staff system
        </p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-stone-50 px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-stone-900">Staff sign in</h2>
            <p className="mt-1 text-sm text-stone-500">
              Use the staff account created by your owner or manager.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@o2.fit"
                />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                />
              </div>
              {loginError && (
                <p role="alert" className="alert-error">
                  {loginError}
                </p>
              )}
              <button className="btn-primary w-full py-2.5" type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <div className="mt-6 border-t border-stone-100 pt-4">
              <p className="text-xs leading-relaxed text-stone-500">
                Sessions expire after 15 minutes of inactivity. Accounts lock for 15 minutes after 5
                wrong attempts — contact the owner if you&apos;re locked out.
              </p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-stone-400">
            Protected staff system · activity on this console is audited
          </p>
        </div>
      </section>
    </main>
  );
}
