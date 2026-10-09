import { z } from "zod";

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
