export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const hit = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  return hit?.slice(name.length + 1);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body !== undefined && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = readCookie("csrf_token");
    if (csrf) headers["x-csrf-token"] = csrf;
  }
  const res = await fetch(BASE + path, { ...init, method, headers, credentials: "include" });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message ?? data.error)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(", ") : String(msg));
  }
  return data as T;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: { id: string; name: string }[];
  permissions: string[];
}
