# API Design — /api/v1 (Phase 0)

Modules: Auth, Users, Roles, Permissions, Members, Enquiries, FollowUps, Packages, Memberships, Billing (Invoices/Payments), Attendance, Devices, Notifications, Reports, Audit, Settings, Health, Jobs(internal).

Endpoint families:

```
/auth/login|logout|refresh|me|change-password|admin-reset
/users, /roles, /permissions
/members (CRUD, /:id/memberships|invoices|attendance|notes)
/enquiries (CRUD, /:id/convert), /follow-ups (overdue|upcoming)
/packages
/memberships, /memberships/:id/renew|extend|suspend|cancel
/invoices, /payments, /payments/:id/refund
/attendance (records|manual|correct), /devices (register|mappings|events:ingest|sync-runs|unmapped)
/reports/* (members|memberships|attendance|enquiries|finance|staff|devices)
/notifications, /audit-logs, /settings
/health/live, /health/ready
/internal/jobs/run (JOBS_SECRET bearer, never exposed to FE)
```

Conventions: envelope `{data, meta:{page,limit,total}}`, correct codes (201 create, 200 ok, 400 validation, 401 unauth, 403 forbidden, 404, 409 conflict/dup), DTO validation, Prisma→DTO mapping (never leak entities), pagination/sort/filter on lists, `Idempotency-Key` header on membership/payment/ingest, Swagger at `/api/docs`, integration tests per protected route.
