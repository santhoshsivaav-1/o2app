"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "../../components/Logo";
import { useAuth } from "../../lib/auth";

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
    <main className="flex min-h-screen items-center justify-center bg-coal-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          <h1 className="text-lg font-semibold">Staff sign in</h1>
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
            <p
              role="alert"
              className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300"
            >
              {loginError}
            </p>
          )}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-xs text-stone-500">
            Sessions expire after 15 minutes of inactivity; sign in again when prompted. Contact the
            owner if your account is locked.
          </p>
        </form>
      </div>
    </main>
  );
}
