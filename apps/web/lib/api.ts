export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const hit = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  return hit?.slice(name.length + 1);
}

let memoryCsrfToken: string | null = null;

export function setCsrfToken(token: string | null | undefined) {
  memoryCsrfToken = token ?? null;
  if (typeof window !== "undefined") {
    try {
      if (token) {
        sessionStorage.setItem("csrf_token", token);
        document.cookie = `csrf_token=${token}; path=/; SameSite=Lax`;
      } else {
        sessionStorage.removeItem("csrf_token");
        document.cookie = "csrf_token=; path=/; max-age=0";
      }
    } catch {}
  }
}

export function getCsrfToken(): string | undefined {
  if (memoryCsrfToken) return memoryCsrfToken;
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("csrf_token");
      if (stored) {
        memoryCsrfToken = stored;
        return stored;
      }
    } catch {}
  }
  return readCookie("csrf_token");
}

let pendingCsrfPromise: Promise<string | undefined> | null = null;

async function ensureCsrfToken(): Promise<string | undefined> {
  const existing = getCsrfToken();
  if (existing) return existing;
  if (pendingCsrfPromise) return pendingCsrfPromise;

  pendingCsrfPromise = (async () => {
    try {
      const res = await fetch(BASE + "/auth/csrf", { credentials: "include" });
      const headerToken = res.headers.get("x-csrf-token");
      const json = await res.json().catch(() => null);
      const token = json?.csrfToken || headerToken || readCookie("csrf_token");
      if (token) {
        setCsrfToken(token);
        return token;
      }
    } catch {}
    return undefined;
  })().finally(() => {
    pendingCsrfPromise = null;
  });

  return pendingCsrfPromise;
}

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body !== undefined && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";

  const isMutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  const isLogin = path.endsWith("/auth/login");

  if (isMutating && !isLogin) {
    let csrf = getCsrfToken();
    if (!csrf) {
      csrf = await ensureCsrfToken();
    }
    if (csrf) {
      headers["x-csrf-token"] = csrf;
    }
  }

  const res = await fetch(BASE + path, { ...init, method, headers, credentials: "include" });

  const csrfHeader = res.headers.get("x-csrf-token");
  if (csrfHeader) {
    setCsrfToken(csrfHeader);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);

  if (data && typeof data === "object" && typeof (data as any).csrfToken === "string") {
    setCsrfToken((data as any).csrfToken);
  }

  if (!res.ok) {
    // If CSRF error occurred on mutating request, attempt one retry after fetching fresh token
    if (
      res.status === 403 &&
      isMutating &&
      (typeof data?.message === "string" && data.message.includes("CSRF"))
    ) {
      setCsrfToken(null);
      const freshToken = await ensureCsrfToken();
      if (freshToken) {
        const retryHeaders = { ...headers, "x-csrf-token": freshToken };
        const retryRes = await fetch(BASE + path, {
          ...init,
          method,
          headers: retryHeaders,
          credentials: "include",
        });
        if (retryRes.status === 204) return undefined as T;
        const retryData = await retryRes.json().catch(() => null);
        if (retryRes.ok) return retryData as T;
      }
    }

    const raw = data && (data.message ?? data.error);
    const message =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.join(", ")
          : raw && typeof raw.message === "string"
            ? raw.message
            : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
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

/** Fetch a binary (CSV/PDF) endpoint and trigger a browser download. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(BASE + path, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const PHOTO_RESIZE_MAX_EDGE = 320;

/** Downscale a picked image to a small JPEG data URL so member photos stay DB-friendly. */
export async function fileToPhotoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    PHOTO_RESIZE_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}
