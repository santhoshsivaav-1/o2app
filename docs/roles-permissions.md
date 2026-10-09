# Roles & Permissions Matrix (Phase 0)

Templates, not hardcoded boundaries. `roles.manage` UI edits `role_permissions`. Backend `PermissionsGuard` enforces; FE nav filtering is cosmetic.

| Permission | Owner | Manager | Receptionist | Trainer | Accountant |
|---|---|---|---|---|---|
| members.read / .create / .update / .archive | Y / Y / Y / Y | Y / Y / Y / N | Y / Y / Y / N | Y / N / N / N | N |
| enquiries.manage | Y | Y | Y | N | N |
| memberships.create / .renew | Y | Y | Y | N | N |
| attendance.read / .correct | Y | Y / Y | Y / N | Y / N | N |
| payments.collect / .refund | Y | Y / N | Y / N | N | Y / Y* |
| reports.financial.read | Y | Y* | N | N | Y |
| reports.attendance.read | Y | Y | Y | Y* | N |
| data.export | Y | Y* | N | N | Y(fin) |
| staff.manage / roles.manage / settings.manage / audit_logs.read | Y | N | N | N | N |

`*` = scoped by permission config (e.g. manager sees collections but not refunds; trainer sees own-batch attendance).

Seed roles with above defaults; Owner created via `pnpm --filter api seed:owner` (interactive, never default password).
