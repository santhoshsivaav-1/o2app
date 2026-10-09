export * from "./members.js";

import { round2 } from "./members.js";

export type RoleName = "owner" | "manager" | "receptionist" | "trainer" | "accountant";

export const PERMISSIONS = [
  "members.read",
  "members.create",
  "members.update",
  "members.archive",
  "enquiries.manage",
  "memberships.create",
  "memberships.renew",
  "attendance.read",
  "attendance.correct",
  "payments.collect",
  "payments.refund",
  "reports.financial.read",
  "reports.attendance.read",
  "staff.manage",
  "roles.manage",
  "settings.manage",
  "audit_logs.read",
  "data.export",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface InvoiceInput {
  subtotal: number;
  discount?: number;
  gstPercent?: number;
  gstInclusive?: boolean;
}

export interface InvoiceCalc {
  taxable: number;
  gst: number;
  total: number;
}

export function calcInvoice(input: InvoiceInput): InvoiceCalc {
  const subtotal = round2(input.subtotal);
  const discount = round2(input.discount ?? 0);
  const pct = input.gstPercent ?? 18;
  if (subtotal < 0 || discount < 0 || discount > subtotal) throw new Error("invalid amounts");
  if (input.gstInclusive) {
    const taxable = round2((subtotal - discount) / (1 + pct / 100));
    return {
      taxable,
      gst: round2(subtotal - discount - taxable),
      total: round2(subtotal - discount),
    };
  }
  const taxable = round2(subtotal - discount);
  const gst = round2((taxable * pct) / 100);
  return { taxable, gst, total: round2(taxable + gst) };
}

export function outstanding(total: number, allocated: number): number {
  return round2(total - allocated);
}

export function hasPermissions(userPerms: readonly string[], required: readonly string[]): boolean {
  return required.every((p) => userPerms.includes(p));
}

export const ROLE_DEFAULTS: Record<RoleName, Permission[]> = {
  owner: [...PERMISSIONS],
  manager: [
    "members.read",
    "members.create",
    "members.update",
    "enquiries.manage",
    "memberships.create",
    "memberships.renew",
    "attendance.read",
    "attendance.correct",
    "payments.collect",
    "reports.financial.read",
    "reports.attendance.read",
    "data.export",
  ],
  receptionist: [
    "members.read",
    "members.create",
    "members.update",
    "enquiries.manage",
    "memberships.create",
    "memberships.renew",
    "attendance.read",
    "payments.collect",
  ],
  trainer: ["members.read", "attendance.read", "reports.attendance.read"],
  accountant: ["payments.collect", "payments.refund", "reports.financial.read", "data.export"],
};

// Membership dates: inclusive end-date rule, timezone-agnostic date strings (YYYY-MM-DD)
export function calcEndDate(startDate: string, durationDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("startDate must be YYYY-MM-DD");
  if (!Number.isInteger(durationDays) || durationDays < 1) throw new Error("durationDays >= 1");
  const d = new Date(startDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + durationDays - 1);
  return d.toISOString().slice(0, 10);
}

export function dedupeKey(deviceId: string, deviceEventId: string): string {
  return `${deviceId}:${deviceEventId}`;
}
