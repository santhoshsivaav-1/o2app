# Implementation Plan — Phases 0–10 (Phase 0 deliverable)

Toolchain verified 2026-10-09: Node v26.7.0, pnpm 9.15.0, repo greenfield (only `prompt.md`), git freshly inited, no legacy code to preserve.

## Phase 0 — Audit & architecture [IN PROGRESS, this doc set]
- [x] Repo/toolchain audit, git init
- [x] `docs/architecture, requirements, database, database-erd, api, roles-permissions, billing-rules, membership-rules, attendance-integration, deployment, backup-restore, security, testing, operations-runbook`
- [ ] Record unresolved decisions (device model, GST %, invoice format — see Risks below)
- Deliverable: doc set + no code changes. Verification: all 14 docs present, `git status` clean-ish.

## Phase 1 — Foundation
Scaffold pnpm+Turborepo, ESLint/Prettier/Husky, env validation, Docker Postgres, Prisma init + first migration, health endpoints, Swagger, `render.yaml`, GH `pr-check.yml`. Verify: `pnpm install/build/lint/typecheck/test` green.

## Phase 2 — Auth & RBAC
Users/roles/permissions/sessions schema + seed-owner CLI (no default password), login/logout/cookies/CSRF/throttle, guards, login page + layout + permission nav, roles UI. Tests: valid/invalid/disabled/revoked/403.

## Phase 3 — Members & Packages
Members CRUD + dedupe + archive + export; packages CRUD with `gstPercent`. Tests: duplicate blocked, pagination, inactive-package blocked.

## Phase 4 — Membership lifecycle
Create/renew/extend/suspend/cancel + inclusive end-date rule + idempotency + renewal history. Tests: early/late renew, double-retry single record.

## Phase 5 — Billing & GST
Invoices/items/payments/allocations/refunds + reconciliation + reports/exports. Tests: full/partial/multi/discount/refund/duplicate-retry/concurrent.

## Phase 6 — Enquiries & follow-ups
Pipeline + assign + overdue + audited convert. Tests: convert creates exactly 1 member, history preserved.

## Phase 7 — Attendance & devices
Adapter interface + simulator + ingest idempotent + unmapped review + manual/correction audit. Tests: duplicate/delayed/unmapped/permission.

## Phase 8 — Dashboard, reports, reminders
12 KPIs + 17 reports + PG job queue + internal cron endpoint + in-app notifications. Tests: date-filter, timezone boundary, reconciliation, permission, export.

## Phase 9 — PWA & responsive
Manifest/icons, safe caching, offline banner, mobile layouts. Tests: installability, desktop/Android/iOS smoke.

## Phase 10 — Security, deploy, recovery
Hardening, Render dual-service deploy, migration safety, backup/restore test on Neon branch, E2E smoke, runbook sign-off. Deliverable: pilot-ready release + limitation doc.

## Risks & unresolved decisions (must close before P4/P5)

1. Device model/protocol UNKNOWN → simulator only; need model + SDK/API docs when available. (Owner: gym)
2. GST: exclusive vs inclusive? Default %? Per-package or global? Invoice numbering `INV-YYYY-####`? (Owner: gym/accountant)
3. Membership end-date inclusivity + suspension (pause extends end?) + overlap on early renew. Default: inclusive, extend-from-old-end. (Owner: gym)
4. Overpayment: credit-forward vs refund-only. Default: credit-forward as adjustment. (Owner)
5. Mandatory member fields + dedupe strictness (phone-exact default?). (Owner)
6. Render free sleep/cold-start + Neon quotas accepted as pilot-only. (Accepted)
7. Dual vs single Render service if quota hit — fallback Dockerfile kept. (Accepted)

## Required env vars (Phase 1+)

```
DATABASE_URL (pooled) | DIRECT_URL (migrate) | JWT_ACCESS_SECRET | JWT_REFRESH_SECRET
SESSION_SECRET | CSRF_SECRET | JOBS_SECRET | DEVICE_API_KEYS (rotatable)
WEB_ORIGIN=https://o2app-web.onrender.com | API_ORIGIN=https://o2app-api.onrender.com
NEXT_PUBLIC_API_URL=https://o2app-api.onrender.com/api/v1
GYM_TIMEZONE=Asia/Kolkata | GST_DEFAULT_PCT=18 | NODE_ENV | PORT (Render-assigned)
```

External deps: Neon Postgres, Render (2 web services), GitHub Actions. No Redis, no paid email/SMS.
