export interface Env {
  nodeEnv: string;
  isProd: boolean;
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  csrfSecret: string;
  webOrigins: string[];
  gymTimezone: string;
  gstDefaultPct: number;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} (see .env.example)`);
  return v;
}

export function loadEnv(): Env {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProd = nodeEnv === "production";
  for (const k of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "CSRF_SECRET"]) {
    const v = process.env[k] ?? "";
    if (v.length < 32) throw new Error(`${k} must be set and at least 32 chars (see .env.example)`);
  }
  return {
    nodeEnv,
    isProd,
    port: Number(process.env.PORT ?? process.env.PORT_API ?? 4000),
    databaseUrl: required("DATABASE_URL"),
    jwtAccessSecret: required("JWT_ACCESS_SECRET"),
    jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
    csrfSecret: required("CSRF_SECRET"),
    webOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(","),
    gymTimezone: process.env.GYM_TIMEZONE ?? "Asia/Kolkata",
    gstDefaultPct: Number(process.env.GST_DEFAULT_PCT ?? 18),
  };
}
