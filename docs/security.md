# Security (Phase 0)

- HTTPS enforced prod (Render TLS); HSTS; `helmet` headers on API; strict CORS (exact WEB_ORIGIN, never `*`).
- Passwords: Argon2id; login throttle (5/15min/IP+account) + constant-time compare; sessions revocable server-side; logout invalidates refresh.
- AuthZ: PermissionsGuard on all protected routes; 401 unauthenticated vs 403 unauthorized; IDOR checks (resource ownership/scope); rate-limit sensitive endpoints (payments, ingest, admin-reset).
- Secrets: only via env/Render dashboard/GitHub Secrets; `.env*` gitignored; `NEXT_PUBLIC_*` allowlist = API URL only; no JWT/device secrets in FE bundle or logs.
- Validation: DTO + Zod shared schemas; file-upload (profile photo) allowlist jpg/png ≤2MB, virus-scan hook point, stored outside DB (local volume/S3 later — pilot: Render disk ephemeral, so photos optional/deferred).
- Logging: no passwords/tokens/PII beyond phone/memberCode; audit_logs for finance/admin/membership/attendance-correction/device-key-rotation.
- Device keys: per-device bearer, rotatable/revocable via settings UI; no fingerprint templates/images stored.
