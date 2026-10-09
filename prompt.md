# MASTER BUILD PROMPT: COMPLETE GYM MANAGEMENT SOFTWARE

## 1. Your role

Act as a senior software architect, full-stack engineer, database architect, UI/UX designer, QA engineer, DevOps engineer, and security engineer.

Build a complete, production-minded **Gym Management System** for a single physical gym location. This must be a real, working application—not a UI prototype, static dashboard, or collection of disconnected screens.

You are responsible for architecture, database design, frontend, backend APIs, authentication, authorization, billing, membership management, attendance, reports, notifications, automated tests, documentation, deployment, and maintenance.

Work directly in the available repository. Inspect the existing project before making changes. Preserve useful existing code, configuration, environment variables, Git history, and working features.

### Non-negotiable rules

1. Do not build the entire application as one giant code-generation task. Divide it into small, verifiable implementation phases.
2. Do not mark features as complete unless their frontend, backend, database integration, and tests are implemented where applicable.
3. Do not use mock data in production screens. Seed data is allowed in development and testing.
4. Do not leave dead buttons, placeholder forms, fake reports, or nonfunctional navigation.
5. Do not expose database credentials, JWT secrets, device credentials, or internal job secrets in frontend code.
6. Do not delete, reset, or overwrite production data.
7. Do not introduce paid services unless explicitly approved.
8. Keep the application portable so hosting can be changed later without rewriting the business logic.
9. When a third-party device integration cannot be completed without hardware details, implement a clean adapter interface and document the missing requirements. Do not fabricate compatibility.
10. After every phase, run relevant checks, fix errors, and report exactly what works, what remains, and any blockers.

---

## 2. Product objective

Create a comprehensive Gym Management System for managing:

- Male, female, and configurable additional member categories.
- New member registrations and profile management.
- Membership packages and subscription periods.
- New memberships, renewals, upgrades, extensions, and cancellations.
- Enquiries, lead follow-ups, and conversion tracking.
- Membership fees, invoices, receipts, partial payments, and outstanding balances.
- Fingerprint-device attendance integration.
- Manual attendance and authorized corrections.
- Membership expiry notifications and follow-up reminders.
- Dashboard analytics and detailed operational reports.
- Staff accounts, roles, permissions, and audit trails.
- Data export, backup, restoration, and operational monitoring.

The first version supports **one gym at one physical location**. Do not add multi-branch complexity unless it is needed for a clean future extension.

The application should be suitable for real daily operations, with careful handling of money, member records, attendance events, and data recovery.

---

## 3. Technology stack

Use the following stack unless repository constraints make a documented alternative necessary.

### Frontend

- Next.js App Router.
- React.
- TypeScript with strict type checking.
- Tailwind CSS.
- shadcn/ui for accessible UI components.
- React Hook Form for complex forms.
- Zod for frontend and shared validation schemas where practical.
- TanStack Query for API data fetching, caching, and mutation management.
- A charting library such as Recharts for reports.
- A suitable table implementation with server-side pagination, sorting, and filtering.
- PWA support using a maintained Next.js-compatible PWA approach.

### Backend

- NestJS.
- TypeScript.
- REST API.
- Prisma ORM.
- PostgreSQL.
- Swagger/OpenAPI documentation.
- JWT-based authentication using secure token handling.
- Password hashing using Argon2id or an appropriately configured alternative.
- DTO validation and centralized exception handling.
- Jest and Supertest for backend tests.

### Testing

- Jest for unit tests.
- Supertest for API integration tests.
- Playwright for end-to-end browser tests.
- Automated linting, type checking, and production builds.

### Deployment target (LOCKED DECISION — Render-only, Option A)

Deploy everything on Render (no Cloudflare Pages split, no frontend/backend separate providers):

- Frontend: Render free web service running Next.js App Router in `output: standalone` mode (Node server). Do NOT use `next export` / static export.
- Backend API: second Render free web service running NestJS (Node), subject to current plan limits.
- Database: Neon PostgreSQL free plan, subject to current quotas.
- Source control and CI/CD: GitHub and GitHub Actions.
- Package manager / monorepo: pnpm + Turborepo (`apps/web`, `apps/api`, `packages/shared`).
- Optional Redis: do not introduce it initially unless a demonstrated requirement justifies it.
- Do not require paid email, SMS, WhatsApp, or monitoring services for the core application.
- Billing: GST is required — packages carry configurable `gstPercent`, invoices show subtotal/discount/GST/total per shared billing math.

Verify current Render + Neon limitations before finalizing deployment configuration. Free plans may change, sleep after ~15 min idle, pause, impose quotas, cold-start 30-60s, or lack production-grade availability. Design PG-backed jobs and cron to process overdue work safely after wake.

The app must still be architected so the API and database can be moved to paid or self-hosted infrastructure later.

---

## 4. Repository architecture

Use a maintainable monorepo if the repository is new or the existing setup supports it.

Suggested structure:

    gym-management/
      apps/
        web/
        api/
      packages/
        shared/
      prisma/
      docs/
      scripts/
      .github/
        workflows/
      render.yaml
      pnpm-workspace.yaml
      turbo.json
      Dockerfile (optional single-service fallback)
      README.md

Use pnpm + Turborepo. Adapt this structure to the existing repository rather than forcing a disruptive restructure.

Responsibilities:

- `apps/web`: frontend pages, components, layouts, forms, client-side API integration, and PWA functionality.
- `apps/api`: NestJS modules, controllers, services, guards, DTOs, integrations, and background job processing.
- `packages/shared`: shared TypeScript types and validation contracts where appropriate.
- `prisma`: database schema and migration history.
- `docs`: architecture, requirements, API, device integration, deployment, backup, and recovery documentation.
- `scripts`: safe development, maintenance, and backup scripts.
- `.github/workflows`: CI, deployment checks, and scheduled task triggers.

Keep business rules in the backend. The frontend must never connect directly to PostgreSQL.

Do NOT use Next.js static export — both services run on Render as Node servers (Option A). Keep SSR/RSC/server actions intact; all server-dependent functionality stays in Next.js standalone + NestJS APIs. Do not silently remove features that require server rendering, server actions, or server-side session handling. `render.yaml` defines `o2app-web` and `o2app-api`; all provider-specific config stays in `render.yaml` + env vars so the stack can move to paid/self-hosted later.

Hardware status (locked): fingerprint device manufacturer/model unknown — build `AttendanceDeviceAdapter` + clearly-labeled simulated adapter for dev/test only; local PC connector deferred until hardware protocol/SDK is confirmed.

---

## 5. User roles and authorization

Implement role-based access control with permissions enforced on the backend.

Suggested default roles:

### Owner / Super Admin

- Full access to gym operations.
- Create and manage staff accounts.
- Configure packages, billing rules, and system settings.
- View all reports.
- Access audit logs and data exports.
- Manage device integrations and backup settings.

### Manager

- Manage members, enquiries, memberships, renewals, attendance, and reports.
- View financial information according to assigned permissions.
- Manage approved operational workflows.
- Cannot modify owner-only security settings unless explicitly permitted.

### Receptionist

- Register members.
- Manage enquiries and follow-ups.
- Create memberships and renewals.
- Record payments and print receipts.
- View permitted member details and attendance.
- Cannot access unrestricted financial reports or staff administration.

### Trainer

- View authorized member profiles.
- View membership validity and attendance as permitted.
- Record or review permitted attendance information.
- Cannot access unrestricted financial records.

### Accountant

- View invoices, payments, outstanding balances, refunds, and financial reports.
- Export permitted financial records.
- Cannot modify authentication settings or device credentials without permission.

These are default role templates, not hardcoded security boundaries.

Implement configurable permissions such as:

- `members.read`
- `members.create`
- `members.update`
- `members.archive`
- `enquiries.manage`
- `memberships.create`
- `memberships.renew`
- `attendance.read`
- `attendance.correct`
- `payments.collect`
- `payments.refund`
- `reports.financial.read`
- `reports.attendance.read`
- `staff.manage`
- `roles.manage`
- `settings.manage`
- `audit_logs.read`
- `data.export`

Build a permission-management screen that lets authorized administrators assign permissions to roles.

Requirements:

- Enforce permissions in NestJS guards or equivalent authorization services.
- Filter frontend navigation according to permissions.
- Never rely on hiding a button as the security mechanism.
- Return appropriate 401 and 403 responses.
- Record sensitive actions in audit logs.
- Prevent unauthorized access to another user's session or protected resources.

---

## 6. Authentication and session management

Implement:

- Login and logout.
- Secure password hashing.
- Change password.
- Administrator-controlled password reset or recovery.
- Session expiration and revocation.
- Login attempt throttling.
- Secure cookie-based authentication where appropriate.
- CSRF protection if cookie-based authentication is used.
- Secure refresh-token rotation if refresh tokens are implemented.
- Server-side session invalidation on logout.
- Authentication audit events.
- A profile page for basic account details and password changes.

Do not store long-lived access tokens or sensitive credentials in localStorage by default.

If the frontend is hosted separately from the API, configure authentication, cookies, CSRF protection, and CORS for the actual deployment origins.

Create the initial owner account through a secure setup command or one-time administrative bootstrap process. Never ship a publicly accessible default admin password.

---

## 7. Core database design

Design a normalized PostgreSQL schema using Prisma.

Include the following logical entities. You may add supporting tables where required, but document important design decisions.

### Staff and access control

- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `sessions` or an equivalent secure session store

### Members and enquiries

- `members`
- `enquiries`
- `follow_ups`
- `member_notes` if appropriate

### Memberships

- `packages`
- `memberships`
- `renewal_events`
- `membership_status_history` if needed

### Billing

- `invoices`
- `invoice_items`
- `payments`
- `payment_allocations`
- `refunds`
- `credit_adjustments` if needed

### Attendance and devices

- `attendance_devices`
- `device_user_mappings`
- `attendance_events`
- `attendance_records`
- `device_sync_runs`

### Notifications and system operations

- `reminder_jobs`
- `notifications`
- `audit_logs`
- `system_job_runs`

### Schema requirements

- Use UUIDs or another consistent, robust identifier strategy.
- Add appropriate foreign keys, indexes, unique constraints, and check constraints where supported.
- Store monetary values using PostgreSQL decimal types, not floating-point arithmetic.
- Store timestamps consistently, preferably in UTC, and render them in the gym's configured timezone.
- Store dates such as membership start and end dates according to clearly documented business rules.
- Include `created_at`, `updated_at`, and relevant actor identifiers where appropriate.
- Use archive or soft-delete behavior for records that must remain historically traceable.
- Do not cascade-delete invoices, payments, refunds, or attendance history.
- Ensure member codes, invoice numbers, and device identifiers follow explicit uniqueness rules.
- Keep migrations version-controlled.
- Avoid storing unnecessary sensitive personal information.
- Do not store fingerprint templates or biometric images in the application database.

Create an ER diagram in `docs/database-erd.md` or an equivalent diagram file.

---

## 8. Member registration and management

Build a complete member-management module.

### Member registration fields

- Automatically generated member ID.
- Full name.
- Mobile number.
- Optional email.
- Configurable gender category.
- Date of birth, if collected.
- Address, if collected.
- Emergency contact, if required.
- Registration date.
- Profile photo, optional.
- Notes.
- Member status.
- Source of enquiry or registration.
- Assigned trainer, if applicable.
- Linked fingerprint device identifier, if applicable.

Collect only data the gym genuinely needs. Configure mandatory fields explicitly.

### Member screens

1. Members list.
2. New member registration.
3. Member profile.
4. Edit member details.
5. Membership history.
6. Payment and invoice history.
7. Attendance history.
8. Notes and follow-up history.
9. Member status and archive actions.

### Member-list functionality

- Search by name, member ID, and mobile number.
- Filter by status, gender category, registration period, package, and membership validity.
- Sort by relevant columns.
- Paginate through server-side queries.
- Export authorized filtered data.
- Provide useful empty, loading, and error states.

### Business rules

- Prevent accidental duplicate registrations using configurable duplicate checks.
- Do not create a second member record when an existing member renews.
- Preserve historical memberships and payments.
- Do not permanently delete members with financial or attendance history.
- Make corrections auditable.

---

## 9. Enquiry and lead management

Create a working CRM-like enquiry module for prospective members.

### Enquiry fields

- Enquiry ID.
- Prospect name.
- Phone number.
- Email, optional.
- Interest or package.
- Lead source.
- Enquiry date.
- Assigned staff member.
- Status.
- Next follow-up date.
- Notes.
- Conversion status.

Suggested statuses:

- New.
- Contacted.
- Follow-up required.
- Trial scheduled.
- Interested.
- Converted.
- Lost.

### Features

- Create, edit, search, and filter enquiries.
- Add dated follow-up activities.
- Assign enquiries to staff.
- Display overdue and upcoming follow-ups.
- Convert an enquiry into a member without duplicating data.
- Preserve the enquiry history after conversion.
- Report on enquiry volume, conversion rate, and lead sources.
- Show the next required action clearly.

Do not count a lead as converted merely because someone opened the registration page. Conversion must be an explicit, auditable operation.

---

## 10. Membership packages and lifecycle

Create a package-management module.

Package fields:

- Package name.
- Description.
- Duration in days or months.
- Standard price.
- Optional registration fee.
- Optional discount rules.
- Active/inactive status.
- Optional restrictions or eligibility rules.

Allow authorized staff to create, edit, deactivate, and view packages.

Do not allow deactivation to destroy historical memberships.

### Membership creation

The workflow should be:

1. Select an existing member or register a new member.
2. Select a package.
3. Choose the membership start date.
4. Calculate the membership end date using documented rules.
5. Apply authorized discounts, if allowed.
6. Display the total payable amount.
7. Record payment or outstanding balance.
8. Create the membership and invoice in a safe database transaction.
9. Display the confirmation and receipt.

### Membership statuses

Support clearly defined states such as:

- Pending payment, if the business rules require it.
- Active.
- Expired.
- Suspended.
- Cancelled.

Define the exact status rules in code and documentation.

### Renewal

- Renew the existing member, not a duplicate member.
- Preserve the previous membership record.
- Record the new membership period.
- Maintain a renewal history.
- Handle renewals before expiry and after expiry.
- Make date-extension and overlap rules explicit.
- Prevent double renewal when a request is retried.
- Record the staff member responsible for the renewal.

Do not assume all memberships start immediately. Support scheduled future start dates where required.

### Membership validity

Implement one consistent definition of membership validity across:

- Dashboard.
- Member profile.
- Attendance eligibility.
- Expiry lists.
- Notifications.
- Reports.

Document how inclusive end dates, timezone boundaries, suspensions, and cancellations affect validity.

---

## 11. Billing, payments, and financial integrity

Build a reliable billing module.

### Required features

- Invoice creation.
- Invoice numbering.
- Invoice line items.
- Package charges.
- Registration fees, if applicable.
- Discounts.
- Tax configuration, if required.
- Cash payments.
- UPI payments.
- Card payments recorded as payment methods.
- Other configurable payment methods.
- Partial payments.
- Outstanding balances.
- Payment receipts.
- Payment history.
- Refund recording with permission controls.
- Daily collection reports.
- Payment-method summaries.
- Invoice and receipt printing.
- PDF and spreadsheet exports.

Recording a UPI or card payment manually does not mean a payment gateway has verified the transaction. Clearly distinguish manually recorded payments from gateway-confirmed payments.

### Required calculations

Define and test:

- Subtotal.
- Discounts.
- Taxes, when enabled.
- Invoice total.
- Total allocated payments.
- Refund totals.
- Outstanding balance.
- Overpayment handling.

The outstanding balance must be derived from a consistent financial model. Do not update unrelated balance fields independently in ways that can become inconsistent.

### Transaction rules

- Invoice and membership creation must be atomic where logically required.
- Payment creation and allocation must be transactional.
- Refunds must be recorded as separate financial events.
- Do not edit a completed payment silently.
- Do not delete financial transactions.
- Use reversal or refund workflows for corrections.
- Prevent duplicate payments caused by retries or double clicks.
- Use idempotency keys or equivalent protection for critical financial requests.
- Validate that a payment cannot be allocated beyond the allowed amount.
- Preserve a complete audit trail.

Create tests covering full payment, partial payment, multiple payments, discounts, refunds, retries, and outstanding balances.

Do not claim compliance with any tax, accounting, or payment standard unless the relevant requirements have been verified.

---

## 12. Fingerprint attendance integration

Attendance must support a fingerprint device, but the manufacturer and model may not yet be known.

Build a provider-independent device integration layer.

### Architecture

Create an interface similar to:

    AttendanceDeviceAdapter
      connect()
      getDeviceInfo()
      fetchAttendanceEvents(cursor)
      mapDeviceUser(deviceUserId)
      acknowledgeEvents(eventIds)
      healthCheck()

Adapt the interface to the actual device SDK or protocol once its manufacturer and model are confirmed.

Do not assume that every fingerprint device exposes an HTTP API. Some devices require a local SDK, proprietary protocol, vendor application, or supported connector.

### Local connector

If required by the actual hardware, create a separate lightweight connector that runs on a gym-owned Windows or Linux computer.

Responsibilities:

- Communicate with the fingerprint device through the supported vendor integration.
- Fetch new attendance events.
- Queue events locally when internet access is unavailable.
- Retry failed synchronization.
- Send events to the NestJS API over authenticated HTTPS.
- Log synchronization results.
- Prevent duplicate event submission.
- Provide device health and last-sync information.
- Support safe upgrades and configuration.

Use a small local database, such as SQLite, only if durable queuing is required.

Do not make the web browser or PWA responsible for maintaining a continuous connection to the fingerprint hardware.

### Device-user mapping

Maintain an explicit mapping between:

- Gym member ID.
- Device identifier.
- Device-specific user ID.
- Mapping status.

Do not assume a device's user ID is the same as the gym's member ID.

### Attendance event processing

- Store the original device event.
- Store device event identifiers where available.
- Use a deterministic deduplication key.
- Make ingestion idempotent.
- Preserve the original timestamp and source.
- Normalize timestamps and timezone handling.
- Handle repeated, delayed, and out-of-order events.
- Maintain synchronization logs.
- Do not silently discard unrecognized device users.
- Provide a review workflow for unmapped users.

### Attendance rules

The initial business requirement is check-in attendance.

Do not invent check-out records or working hours. If the device produces repeated scans, define configurable duplicate-scan rules. Store raw events separately from the final attendance record so the processing rules can be changed without losing source data.

Provide:

- Attendance dashboard.
- Daily attendance list.
- Member attendance history.
- Attendance search and filters.
- Manual check-in with permission control.
- Audited corrections.
- Unmapped-device-user review.
- Device status and synchronization history.
- Attendance export and reports.

If the hardware is not yet available, build a simulated adapter only for development and testing. Label simulated events clearly and never present them as real device data.

---

## 13. Dashboard and reporting

Create a professional dashboard backed by real database queries.

### Dashboard metrics

- Total members.
- Active members.
- Expired memberships.
- Memberships expiring soon.
- New registrations for the selected period.
- Renewals for the selected period.
- Today's attendance.
- Today's enquiries.
- Outstanding payments.
- Collections for the selected period.
- Follow-ups due.
- Recent important activities.

### Reports

1. Member directory report.
2. New registration report.
3. Active and expired membership report.
4. Membership expiry report.
5. Renewal report.
6. Attendance by day.
7. Attendance by member.
8. Attendance trends.
9. Enquiry and conversion report.
10. Follow-up performance report.
11. Invoice report.
12. Payment collection report.
13. Outstanding balance report.
14. Refund report.
15. Payment-method summary.
16. Staff activity and audit report.
17. Device synchronization report.

### Reporting requirements

- Date-range filters.
- Search and relevant grouping.
- Server-side aggregation.
- Pagination for detailed lists.
- Export to CSV or XLSX.
- PDF reports where useful.
- Print-friendly invoices and receipts.
- Clear definitions for every KPI.
- Consistent timezone and date-range semantics.
- Reconciliation with underlying records.

Do not calculate financial reports from dashboard cards or cached frontend totals. Query the underlying financial records using consistent business rules.

Document whether a report measures invoice date, payment date, membership start date, attendance event time, or another explicitly defined date.

---

## 14. Expiry reminders and scheduled tasks

Implement configurable reminders for:

- Upcoming membership expiry.
- Expired memberships.
- Overdue enquiry follow-ups.
- Outstanding balances, if enabled.

Allow authorized administrators to configure reminder windows and disable individual reminder categories.

### Initial free-tier implementation

Avoid requiring Redis or a continuously running paid worker initially.

Use a PostgreSQL-backed job queue with fields such as:

- Job ID.
- Job type.
- Scheduled time.
- Status.
- Attempt count.
- Last attempt.
- Last error.
- Idempotency key.
- Creation time.
- Completion time.

Support statuses such as:

- Pending.
- Processing.
- Completed.
- Retry.
- Failed.

Use safe database locking or atomic job claiming to avoid two workers processing the same job simultaneously.

Implement:

- Retry with backoff.
- Idempotent job handlers.
- Failed-job logging.
- A safe retry mechanism.
- A record of processed reminders.
- A protected internal endpoint for scheduled job execution.

GitHub Actions may trigger scheduled jobs. Store API URLs and job secrets in GitHub Secrets. Never place the job secret in the frontend or public repository.

Scheduled workflows may be delayed, so design jobs to process overdue work safely. Also consider recovery when the API wakes after being idle.

### Notification channels

Build a notification abstraction.

Initially, support in-app notifications and, where useful, a development-only email adapter.

Do not require paid SMS or WhatsApp services. Add those integrations only after the gym approves the provider and budget.

Do not mark a notification as delivered unless the selected provider confirms delivery or the system has a clearly defined delivery state.

---

## 15. User interface and design system

Build a polished, professional, easy-to-use interface suitable for gym staff.

### Visual direction

- Clean, modern administrative dashboard.
- Consistent spacing, typography, and colors.
- Clear visual hierarchy.
- Readable tables and forms.
- Accessible contrast.
- Subtle animations.
- Fast navigation.
- Professional empty states.
- Clear validation and error messages.
- No unnecessary visual clutter.

Avoid designing only for desktop. Reception staff may use phones or tablets.

### Layout

Desktop:

- Sidebar navigation.
- Top bar with page title, search or quick actions where useful, notifications, and user menu.
- Responsive content area.
- Tables and dashboards optimized for larger screens.

Mobile:

- Compact navigation.
- Touch-friendly actions.
- Responsive cards or horizontally manageable tables.
- Forms that fit small screens.
- No clipped dialogs or unusable dropdowns.
- Easy member search and attendance access.

### Main navigation

- Dashboard.
- Members.
- Enquiries.
- Follow-ups.
- Memberships.
- Packages.
- Attendance.
- Billing.
- Reports.
- Notifications.
- Staff and permissions.
- Device integration.
- Audit logs.
- Settings.

Only display navigation items permitted for the current user.

### Shared UI components

Create reusable components for:

- Data tables.
- Search and filters.
- Pagination.
- Date-range selection.
- Form fields.
- Confirmation dialogs.
- Status badges.
- Summary cards.
- Toast notifications.
- Loading skeletons.
- Error states.
- Empty states.
- Invoice and receipt views.
- Permission-aware actions.

Do not duplicate the same complex UI logic across pages.

---

## 16. PWA requirements

Make the frontend installable where supported.

Implement:

- Web app manifest.
- App name and icons.
- Theme color.
- Installability requirements.
- Appropriate caching.
- Update detection and a controlled update experience.
- Responsive behavior on Android, iOS, tablets, and desktop.

### Offline behavior

The application must not pretend that every operation works offline.

Support safe offline behavior for appropriate read-only assets and screens.

For any offline mutation, explicitly design:

- What is stored locally.
- Whether the data is sensitive.
- How the action is authenticated.
- How queued changes are synchronized.
- How conflicts are resolved.
- How duplicate submissions are prevented.
- What happens when the user logs out or loses authorization.

Do not cache authentication responses, financial information, or member records indiscriminately.

Do not depend on browser background execution for reliable reminders or continuous fingerprint attendance synchronization.

Show a clear offline indicator and explain when an action requires an internet connection.

---

## 17. API design

Use versioned REST endpoints under `/api/v1`.

Organize NestJS into modules such as:

- AuthModule.
- UsersModule.
- RolesModule.
- PermissionsModule.
- MembersModule.
- EnquiriesModule.
- FollowUpsModule.
- PackagesModule.
- MembershipsModule.
- BillingModule.
- PaymentsModule.
- AttendanceModule.
- DevicesModule.
- NotificationsModule.
- ReportsModule.
- AuditModule.
- SettingsModule.
- HealthModule.
- JobsModule.

Suggested endpoint families:

    /api/v1/auth/*
    /api/v1/users/*
    /api/v1/roles/*
    /api/v1/permissions/*
    /api/v1/members/*
    /api/v1/enquiries/*
    /api/v1/follow-ups/*
    /api/v1/packages/*
    /api/v1/memberships/*
    /api/v1/memberships/:id/renew
    /api/v1/invoices/*
    /api/v1/payments/*
    /api/v1/payments/:id/refund
    /api/v1/attendance/*
    /api/v1/devices/*
    /api/v1/reports/*
    /api/v1/notifications/*
    /api/v1/audit-logs/*
    /api/v1/health/live
    /api/v1/health/ready

Create endpoints based on resource ownership and business workflows rather than blindly implementing this list.

Requirements:

- Consistent request and response structures.
- DTO validation.
- Correct HTTP status codes.
- Pagination, sorting, and filtering.
- Authentication and authorization.
- Safe error responses without stack traces or secrets.
- Idempotency for critical financial and synchronization operations.
- Swagger documentation.
- Integration tests for protected routes.
- Explicit API versioning strategy.

Do not expose Prisma entities directly as unrestricted API responses.

---

## 18. Security, privacy, and auditability

Implement:

- HTTPS in deployed environments.
- Strong password hashing.
- Authentication and authorization on every protected route.
- Rate limiting for authentication and sensitive endpoints.
- Strict CORS configuration.
- Input validation.
- Protection against injection and insecure direct-object references.
- Secure HTTP headers.
- Secret management through hosting-provider environment variables.
- Safe logging that excludes passwords, tokens, and unnecessary personal information.
- Audit logs for financial, administrative, membership, and attendance corrections.
- Access-controlled exports.
- Database backup and recovery procedures.
- Session revocation.
- Appropriate file-upload validation if photos or attachments are supported.

Never use CORS as a substitute for authentication.

Use a separate device credential for a local connector where applicable. Provide a way to revoke or rotate that credential.

Avoid logging fingerprint data. Store only the minimum device identifiers and attendance metadata needed for the integration.

Document data retention, access controls, and the process for handling data corrections or member data requests.

---

## 19. Database migrations and safe deployment

The gym may use the application while updates are being deployed. Design deployments to minimize interruption and prevent data loss.

### Rules

- Use version-controlled Prisma migrations.
- Never run destructive database resets against production.
- Do not automatically execute risky migrations every time the API starts.
- Back up data before risky schema changes.
- Prefer backward-compatible, additive migrations.
- Separate schema migration, data backfill, and removal of obsolete columns.
- Keep API changes compatible with the currently deployed frontend during rollout where possible.
- Make database initialization and seed commands environment-safe.
- Keep production secrets out of Git.

### Release workflow

1. Make changes on a development branch.
2. Run formatting, linting, type checks, unit tests, and integration tests.
3. Build frontend and backend.
4. Test the change in a staging environment where available.
5. Review the migration for destructive operations.
6. Take a backup when warranted.
7. Apply backward-compatible migrations.
8. Deploy the API.
9. Verify health checks and critical workflows.
10. Deploy the frontend.
11. Run smoke tests.
12. Review errors and logs.
13. Document rollback steps.

Do not claim zero downtime on infrastructure that cannot guarantee it. On free hosting, the API may sleep, restart, or become temporarily unavailable.

Provide a rollback plan that considers both application code and database schema. Do not automatically roll back a migration if doing so could destroy new data.

---

## 20. Free-tier deployment implementation (Render-only, Option A)

Prepare the project for deployment on Render only, without requiring paid infrastructure for the initial pilot. Two Render Web Services behind a `render.yaml` blueprint: `o2app-web` (Next.js standalone) + `o2app-api` (NestJS). Fallback if free quotas are hit: single Docker service (Next static + Nest proxied via `/api/*`) — keep a portable Dockerfile so the collapse requires no business-logic rewrite.

### Frontend (`o2app-web` on Render)

- Build Next.js App Router with `output: standalone`; start with `node server.js` on Render's assigned `$PORT`.
- Do NOT use static export. Keep SSR/RSC, server components, and PWA service worker fully functional.
- All data access via NestJS REST (`NEXT_PUBLIC_API_URL=https://o2app-api.onrender.com/api/v1`); frontend must never connect directly to PostgreSQL.
- Configure exact `API_ORIGIN` allowlist, asset paths (`assetPrefix` if needed), icons, manifest, and PWA behavior on Render headers.
- Add `/healthz` lightweight route for Render health checks; handle cold-start retries from the API client (TanStack Query retry + timeout).

### Backend (`o2app-api` on Render)

- Use the hosting provider's assigned port (`$PORT`) on both services.
- Provide liveness (`/api/v1/health/live`) and readiness (`/api/v1/health/ready`, checks DB) health checks; wire both into Render healthCheckPath.
- Use production environment variables (see §27 env list); never bundle secrets into `NEXT_PUBLIC_*` except the public API base URL.
- Configure exact allowed frontend origins (`WEB_ORIGIN=https://o2app-web.onrender.com`); strict CORS + cookie `SameSite=None; Secure` + CSRF for cross-subdomain auth.
- Handle shutdown signals and database connections properly.
- Avoid in-memory storage for critical business data or durable jobs.
- Handle slow cold starts gracefully.

### Database

- Use Neon PostgreSQL for the initial database.
- Keep connection configuration in environment variables.
- Use a pooled connection string for application workloads when appropriate.
- Use a direct connection string for migrations if required by the selected configuration.
- Verify connection limits and the chosen Prisma version's connection behavior.
- Add indexes for frequent search and report queries.
- Keep database migrations under version control.

### CI/CD

Create GitHub Actions workflows for:

- Pull-request checks.
- Linting.
- Type checking.
- Unit tests.
- Build verification.
- Safe deployment steps where configured.
- Scheduled reminder processing, if used.

Do not place deployment secrets in workflow files.

### Important limitation (Render free)

The Render-only free-tier architecture is intended to reduce costs during development and an early pilot. It is not a guarantee of always-on availability, continuous attendance synchronization, permanent free service, or production-grade backups. Both web and api services sleep when idle and cold-start slowly; GitHub Actions cron may be delayed — jobs must be idempotent and process overdue windows.

Keep provider-specific configuration isolated so that the API, database, and worker can be moved later without redesigning business logic.

---

## 21. Backups and disaster recovery

Create a documented backup strategy.

Include:

- A database backup command using `pg_dump`.
- A safe restore procedure using `pg_restore`.
- Independent storage for backup files.
- Encryption and access controls for backups.
- Backup verification.
- A periodic restore test.
- Documented recovery steps.
- A checklist for verifying members, memberships, invoices, payments, and attendance after restoration.

Do not treat GitHub Actions logs or short-lived CI artifacts as permanent backup storage.

Do not run restore operations against production unless explicitly authorized and the impact is understood.

Document the limitations of the free database plan and provide a manual backup procedure suitable for the pilot.

---

## 22. Testing and acceptance criteria

Create unit, integration, and end-to-end tests.

### Authentication

- Valid login succeeds.
- Invalid login fails safely.
- Disabled users cannot log in.
- Expired or revoked sessions are rejected.
- Unauthorized users cannot access protected endpoints.

### Members

- Valid registration succeeds.
- Invalid fields are rejected.
- Duplicate checks work.
- Search and pagination work.
- Historical member data is preserved.

### Memberships

- New membership creation works.
- Renewal preserves the previous membership.
- Expiry calculation follows documented rules.
- Retried renewal requests do not create duplicates.
- Inactive packages cannot be selected for new memberships unless the business rules explicitly allow it.

### Billing

- Full payment.
- Partial payment.
- Multiple partial payments.
- Outstanding balance.
- Discount calculation.
- Refund and reversal.
- Duplicate payment request.
- Concurrent payment attempts.
- Invoice and payment reconciliation.

### Attendance

- Valid device event ingestion.
- Duplicate event handling.
- Delayed event synchronization.
- Unmapped device user handling.
- Manual attendance permission checks.
- Audited attendance corrections.
- Offline connector retry behavior where implemented.

### Enquiries

- Enquiry creation.
- Follow-up scheduling.
- Overdue follow-up reporting.
- Lead conversion without duplicate member creation.

### Reports

- Date filtering.
- Timezone boundaries.
- Reconciliation against source records.
- Permission enforcement.
- Export correctness.

### Deployment

- Production builds succeed.
- Health endpoints work.
- Database migrations apply correctly in a test environment.
- The frontend can reach the deployed API.
- Secrets are not bundled into frontend assets.
- Critical workflows pass smoke tests.

Use realistic test data. Never use live customer data in test environments unless it has been appropriately protected and explicitly authorized.

---

## 23. Required project documentation

Create and maintain:

- `README.md`: setup and development instructions.
- `docs/architecture.md`: system architecture and major design decisions.
- `docs/requirements.md`: functional and nonfunctional requirements.
- `docs/database-erd.md`: entity relationships.
- `docs/database.md`: schema conventions and migration procedures.
- `docs/api.md`: API structure and Swagger instructions.
- `docs/roles-permissions.md`: role and permission matrix.
- `docs/billing-rules.md`: financial calculations and transaction rules.
- `docs/membership-rules.md`: renewal, expiry, suspension, and date handling.
- `docs/attendance-integration.md`: adapter design and hardware prerequisites.
- `docs/deployment.md`: frontend, backend, and database deployment.
- `docs/backup-restore.md`: backup and recovery procedures.
- `docs/security.md`: security controls and secret management.
- `docs/testing.md`: test commands and acceptance criteria.
- `docs/operations-runbook.md`: routine operations, failures, and recovery.

Keep documentation synchronized with the implementation.

---

## 24. Development phases

Do not attempt every feature in a single uncontrolled code-generation pass. Implement and verify the following phases in order.

### Phase 0 — Repository audit and architecture

- Inspect the current repository.
- Identify framework versions, package manager, existing modules, deployment settings, environment files, and tests.
- Identify broken functionality and compatibility issues.
- Document the architecture and development plan.
- Identify unknown requirements, especially the fingerprint device model.
- Avoid modifying working code until the audit is complete.

Deliverable: architecture and implementation plan.

### Phase 1 — Project foundation

- Set up frontend and backend.
- Configure TypeScript, linting, formatting, environment validation, and shared conventions.
- Configure PostgreSQL and Prisma.
- Add initial migrations.
- Add Swagger and health endpoints.
- Establish CI checks.

Deliverable: working development environment and build pipeline.

### Phase 2 — Authentication and permissions

- Implement login, logout, sessions, password management, roles, permissions, and protected routes.
- Build the login page and application layout.
- Add permission-aware navigation.
- Test access control.

Deliverable: secure application shell.

### Phase 3 — Members and packages

- Build member registration and management.
- Implement search, filters, pagination, and profile pages.
- Build package management.
- Add member history and validation.

Deliverable: working member and package modules.

### Phase 4 — Membership lifecycle

- Implement membership creation, renewal, expiry rules, and membership history.
- Add transaction safety and idempotency.
- Add membership reports and tests.

Deliverable: complete membership workflow.

### Phase 5 — Billing and payments

- Implement invoices, line items, payment methods, partial payments, outstanding balances, refunds, and receipts.
- Add financial reconciliation.
- Add protected financial reports and exports.

Deliverable: complete billing workflow.

### Phase 6 — Enquiries and follow-ups

- Implement enquiry management, assignments, follow-up activities, lead conversion, and performance reports.

Deliverable: functional enquiry management.

### Phase 7 — Attendance and device integration

- Build attendance records, device mappings, event ingestion, deduplication, synchronization logs, and manual attendance.
- Implement a device adapter.
- Add the local connector only after confirming the actual hardware protocol or SDK.
- Test duplicate, delayed, and unmapped events.

Deliverable: reliable attendance module with documented hardware dependencies.

### Phase 8 — Dashboard, reports, and reminders

- Implement dashboard queries.
- Complete detailed reports and exports.
- Implement PostgreSQL-backed reminder jobs.
- Add the protected scheduler endpoint and recovery logic.

Deliverable: operational dashboard and automation.

### Phase 9 — PWA, responsive design, and usability

- Finish mobile and tablet layouts.
- Implement installation requirements and safe caching.
- Add offline indicators and appropriate update behavior.
- Test on desktop, Android, and iOS browsers.

Deliverable: responsive, installable application where supported.

### Phase 10 — Security, deployment, and recovery

- Complete security checks.
- Verify deployment configuration.
- Test migrations and release procedures.
- Configure backups and restore tests.
- Run end-to-end smoke tests.
- Finalize operational documentation.

Deliverable: tested pilot-ready release with clearly documented limitations.

---

## 25. Rules for the AI coding agent

Follow these instructions throughout development.

### Before coding

1. Inspect the existing repository.
2. Identify the package manager and exact framework versions.
3. Read existing documentation and environment examples.
4. Identify available scripts and current test coverage.
5. List risks and unresolved requirements.
6. Propose the smallest safe next implementation step.

### While coding

- Implement real database operations.
- Keep controllers thin and business logic in services.
- Use DTOs and validation.
- Use database transactions for multi-step financial and membership operations.
- Add indexes based on actual query patterns.
- Avoid giant components and duplicated logic.
- Use shared types without coupling the frontend directly to Prisma.
- Add tests alongside critical business logic.
- Run formatting, linting, type checking, and relevant tests.
- Fix regressions before proceeding.
- Keep commits or change sets small and understandable.
- Never put secrets in code or logs.
- Never make destructive production changes without explicit approval.

### When encountering uncertainty

Do not silently invent critical business rules.

For routine implementation choices, choose a sensible default and document it.

For decisions affecting billing, membership dates, refunds, biometric hardware compatibility, security, or data migration, ask for clarification when the correct behavior cannot be inferred safely.

If a requirement depends on unavailable hardware or a third-party account, finish the independent parts and clearly identify the remaining dependency.

### After each phase

Provide a concise report containing:

- Features implemented.
- Important files created or modified.
- Database migrations added.
- Tests executed and their results.
- Build and type-check results.
- Known issues.
- Unresolved decisions.
- Required environment variables.
- Instructions for manually verifying the feature.
- The next recommended phase.

Do not claim tests passed if they were not executed. Do not claim a deployment succeeded if it was not actually verified.

---

## 26. Definition of done

The project is complete only when:

- All required modules are implemented and integrated.
- Members, memberships, renewals, invoices, payments, attendance, and reports use real persistent data.
- Role-based access is enforced on the backend.
- Critical financial operations are transactional and auditable.
- Membership and attendance history is preserved.
- Duplicate requests and device events are handled safely.
- All major screens work on desktop, tablet, and mobile.
- PWA behavior has been tested on supported platforms.
- API documentation is available.
- Critical unit and integration tests pass.
- Key end-to-end workflows pass.
- Production builds succeed.
- Database migrations and backup restoration have been tested in a safe environment.
- Deployment and recovery instructions are complete.
- Hardware-specific limitations are documented honestly.
- No known critical security, data-integrity, or billing defects remain unresolved.

Do not represent the application as production-ready while critical acceptance criteria remain unverified.

---

## 27. Start here

Begin with **Phase 0 only**.

Inspect the repository and produce:

1. A current-state audit.
2. A proposed architecture.
3. A feature-by-feature implementation checklist.
4. A database relationship plan.
5. An API module plan.
6. A role-permission matrix.
7. A phased implementation plan.
8. A list of risks and unresolved business decisions.
9. A list of required environment variables and external dependencies.
10. A proposed test strategy.

Do not rewrite the entire repository or generate all modules immediately.

Once the audit is complete, implement Phase 1 in small, testable steps. Continue through the remaining phases in order, verifying each phase before proceeding.

**Primary objective:** Deliver a reliable, maintainable Gym Management System that starts with minimal infrastructure cost, protects the gym's operational data, and can scale to more reliable hosting without a fundamental rewrite.`