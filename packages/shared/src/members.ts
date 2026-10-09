import { z } from "zod";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Keep only digits; for Indian numbers keep the last 10 (drops +91/0 prefix). */
export function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function packageDurationDays(value: number, unit: "DAY" | "MONTH"): number {
  if (!Number.isInteger(value) || value < 1) throw new Error("duration must be >= 1");
  return unit === "MONTH" ? value * 30 : value;
}

export function formatMemberCode(year: number, seq: number): string {
  return `O2-${year}-${String(seq).padStart(4, "0")}`;
}

export function formatInvoiceNo(year: number, seq: number): string {
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

const DAY_MS = 24 * 3600 * 1000;

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round(
    (new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / DAY_MS,
  );
}

/** YYYY-MM-DD of an instant in the gym's timezone (default Asia/Kolkata). */ export function toDateStrInTimezone(
  date: Date,
  tz: string,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayInTimezone(tz: string): string {
  return toDateStrInTimezone(new Date(), tz);
}

// ---------- billing ----------

export interface PaymentMethod {
  key: string;
  label: string;
  needsReference: boolean;
}

/** All Phase-5 methods are manually recorded — none is gateway-confirmed. */
export const PAYMENT_METHODS: PaymentMethod[] = [
  { key: "cash", label: "Cash", needsReference: false },
  { key: "upi_manual", label: "UPI (recorded manually)", needsReference: true },
  { key: "card_manual", label: "Card (recorded manually)", needsReference: true },
  { key: "bank_transfer_manual", label: "Bank transfer (manual)", needsReference: true },
  { key: "other", label: "Other", needsReference: false },
];

export function paymentMethod(key: string): PaymentMethod | undefined {
  return PAYMENT_METHODS.find((m) => m.key === key);
}

/** Outstanding is always derived: total − allocated. Refunds are separate events. */
export function invoiceOutstanding(total: number, paid: number): number {
  return round2(total - paid);
}

export type InvoiceStatus = "unpaid" | "partial" | "paid" | "refunded";

export function recomputeInvoiceStatus(
  total: number,
  paid: number,
  refunded: number,
): InvoiceStatus {
  if (refunded > 0 && round2(paid - refunded) <= 0) return "refunded";
  if (paid <= 0) return "unpaid";
  if (round2(paid) >= round2(total)) return "paid";
  return "partial";
}

/**
 * Renewal start rule (locked): never overlap. Early/on-time renewals continue
 * the day after the previous end; late renewals start on the requested date.
 */
export function renewalStartDate(prevEnd: string, requestedStart: string): string {
  return requestedStart > prevEnd ? requestedStart : addDays(prevEnd, 1);
}

export type LifecycleStatus = "active" | "suspended" | "cancelled";

export type Validity = "scheduled" | "active" | "expired" | "suspended" | "cancelled";

export function membershipStatus(start: string, end: string, today: string): Validity {
  if (today < start) return "scheduled";
  if (today > end) return "expired";
  return "active";
}

/**
 * Single validity definition used by dashboard, profile, attendance eligibility,
 * expiry lists, notifications and reports.
 */
export function membershipValidity(
  start: string,
  end: string,
  today: string,
  status: LifecycleStatus,
): Validity {
  if (status === "suspended" || status === "cancelled") return status;
  return membershipStatus(start, end, today);
}

export const memberStatusSchema = z.enum(["active", "inactive", "archived"]);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

export const memberSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  mobile: z
    .string()
    .trim()
    .min(10, "Mobile must have at least 10 digits")
    .max(17)
    .refine((v) => normalizeMobile(v).length >= 10, "Invalid mobile number"),
  email: z.string().trim().email("Invalid email").max(160).optional().or(z.literal("")),
  genderId: z.string().uuid("Select a gender category"),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "DOB must be YYYY-MM-DD")
    .refine((v) => v <= new Date().toISOString().slice(0, 10), "DOB cannot be in the future")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  emergencyContact: z.string().trim().max(120).optional().or(z.literal("")),
  registrationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Registration date must be YYYY-MM-DD")
    .optional(),
  photoUrl: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  status: memberStatusSchema.optional(),
  source: z.string().trim().max(80).optional().or(z.literal("")),
  assignedTrainerId: z.string().uuid().optional().or(z.literal("")),
  deviceUserId: z.string().trim().max(80).optional().or(z.literal("")),
  confirmDuplicate: z.boolean().optional(),
});
export type MemberInput = z.infer<typeof memberSchema>;

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const packageSchema = z.object({
  name: z.string().trim().min(1, "Package name is required").max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  durationValue: z.number().int().min(1, "Duration must be at least 1"),
  durationUnit: z.enum(["DAY", "MONTH"]),
  price: z.number().min(0, "Price cannot be negative"),
  registrationFee: z.number().min(0).optional().default(0),
  discountMaxPct: z.number().min(0).max(100).optional(),
  gstPercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional().default(true),
  eligibility: z.string().trim().max(500).optional().or(z.literal("")),
});
export type PackageInput = z.infer<typeof packageSchema>;

/** Normalize "" → undefined for optional fields before persistence. */
export function cleanMemberInput<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "confirmDuplicate") continue;
    out[k] = emptyToUndefined(v);
  }
  return out as T;
}
