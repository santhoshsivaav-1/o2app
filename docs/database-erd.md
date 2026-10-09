# Database ERD (Phase 0 plan — implemented in Phase 1 Prisma schema)

```mermaid
erDiagram
  users ||--o{ user_roles : has
  roles ||--o{ user_roles : assigned
  roles ||--o{ role_permissions : has
  permissions ||--o{ role_permissions : granted
  users ||--o{ sessions : owns
  users ||--o{ audit_logs : acts

  members ||--o{ memberships : holds
  members ||--o{ member_notes : noted
  packages ||--o{ memberships : defines
  memberships ||--o{ renewal_events : renews
  memberships ||--|| invoices : bills
  invoices ||--o{ invoice_items : contains
  invoices ||--o{ payment_allocations : settled
  payments ||--o{ payment_allocations : allocates
  payments ||--o{ refunds : reversed

  enquiries ||--o{ follow_ups : tracks
  enquiries ||--o| members : converts

  attendance_devices ||--o{ device_user_mappings : maps
  members ||--o{ device_user_mappings : linked
  attendance_devices ||--o{ attendance_events : emits
  attendance_events ||--o| attendance_records : derives
  members ||--o{ attendance_records : attends
  attendance_devices ||--o{ device_sync_runs : syncs

  reminder_jobs ||--o{ notifications : triggers
  users ||--o{ notifications : receives
```

Tables: users, roles, permissions, user_roles, role_permissions, sessions, members, member_notes, enquiries, follow_ups, packages, memberships, renewal_events, membership_status_history, invoices, invoice_items, payments, payment_allocations, refunds, credit_adjustments, attendance_devices, device_user_mappings, attendance_events, attendance_records, device_sync_runs, reminder_jobs, notifications, audit_logs, system_job_runs.
