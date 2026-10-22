import { Injectable } from "@nestjs/common";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import {
  diffDays,
  emergencyRelationshipLabel,
  invoiceOutstanding,
  membershipValidity,
  ptEndDate,
  round2,
  todayInTimezone,
} from "@o2app/shared";

// ---------- identity & formatting ----------

export interface GymIdentity {
  name: string;
  address: string;
  phone: string;
  founder: string;
}

export function gymIdentity(): GymIdentity {
  return {
    name: process.env.GYM_NAME ?? "Oxygen Fitness",
    address: process.env.GYM_ADDRESS ?? "",
    phone: process.env.GYM_PHONE ?? "",
    founder: process.env.GYM_FOUNDER ?? "Founder",
  };
}

const IN_FMT = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/** Standard fonts have no ₹ glyph — invoices use the "Rs." prefix. */
const inr = (n: unknown) => `Rs. ${IN_FMT.format(Number(n ?? 0))}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dmy(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Indian-system amount in words, e.g. "Rupees Twelve Thousand Five Hundred Only". */
function amountInWords(value: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number): string =>
    n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
  const three = (n: number): string =>
    n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${two(n % 100)}` : ""}` : two(n);
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "Rupees Zero Only";
  const crores = Math.floor(n / 10_000_000);
  const lakhs = Math.floor((n % 10_000_000) / 100_000);
  const thousands = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crores) parts.push(`${crores >= 100 ? three(crores) : two(crores)} Crore`);
  if (lakhs) parts.push(`${three(lakhs)} Lakh`);
  if (thousands) parts.push(`${three(thousands)} Thousand`);
  if (rest) parts.push(three(rest));
  const paise = Math.round((value - n) * 100);
  return `Rupees ${parts.join(" ")} Only${paise ? ` (and ${two(paise)} Paise)` : ""}`;
}

// ---------- shared drawing state ----------

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 42;

const INK = rgb(0.12, 0.13, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.86, 0.88);
const BRAND = rgb(0.05, 0.45, 0.62);
const BRAND_BG = rgb(0.9, 0.96, 0.98);
const HEAD_BG = rgb(0.94, 0.95, 0.96);
const ZEBRA = rgb(0.97, 0.978, 0.985);
const BADGE_BG = rgb(0.85, 0.95, 0.88);

/** Mutable canvas cursor shared by the drawing helpers for one document. */
class Page {
  doc!: PDFDocument;
  page!: import("pdf-lib").PDFPage;
  y = PAGE_H - MARGIN_X;
  regular!: PDFFont;
  bold!: PDFFont;

  ensure(room: number) {
    if (this.y - room < 52) {
      this.page = this.doc.addPage([PAGE_W, PAGE_H]);
      this.y = PAGE_H - MARGIN_X;
    }
  }

  text(
    value: string,
    x: number,
    size: number,
    opts: { bold?: boolean; color?: ReturnType<typeof rgb>; width?: number; align?: "left" | "right" | "center" } = {},
  ): number {
    const font = opts.bold ? this.bold : this.regular;
    let tx = x;
    if (opts.width) {
      const w = font.widthOfTextAtSize(value, size);
      if (opts.align === "right") tx = x + opts.width - w;
      else if (opts.align === "center") tx = x + (opts.width - w) / 2;
    }
    this.page.drawText(value, { x: tx, y: this.y, size, font, color: opts.color ?? INK });
    return font.widthOfTextAtSize(value, size);
  }

  hr(color = LINE) {
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y + 3 },
      end: { x: PAGE_W - MARGIN_X, y: this.y + 3 },
      thickness: 0.7,
      color,
    });
  }
}

function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [value];
}

// ---------- data shapes (fed from the existing read services) ----------

export interface InvoicePdfData {
  invoiceNo: string;
  issuedAt: Date;
  status: string;
  subtotal: unknown;
  discount: unknown;
  taxable: unknown;
  gst: unknown;
  gstPercent?: unknown;
  total: unknown;
  paid: number;
  refunded: number;
  outstanding: number;
  notes?: string | null;
  items: { label: string; qty: number; unitPrice: unknown; amount: unknown }[];
  allocations?: { amount: unknown; payment?: { method: string; paidAt: Date; reference?: string | null } }[];
  member: {
    memberCode: string;
    fullName: string;
    mobile: string;
    email?: string | null;
    dob?: Date | null;
    address?: string | null;
    gender?: { name: string } | null;
    assignedTrainer?: { name: string } | null;
    emergName?: string | null;
    emergRelationship?: string | null;
    emergMobile?: string | null;
    emergAddress?: string | null;
  };
  membership?: {
    startDate: Date;
    endDate: Date;
    status: string;
    package?: { name: string } | null;
    ptTotal?: unknown;
    ptDurationMonths?: unknown;
    ptStart?: Date | null;
    ptTrainer?: { name: string } | null;
  } | null;
}

export interface MemberPdfData {
  memberCode: string;
  fullName: string;
  mobile: string;
  email?: string | null;
  dob?: Date | null;
  address?: string | null;
  photoUrl?: string | null;
  status: string;
  registrationDate?: Date | null;
  source?: string | null;
  notes?: string | null;
  gender?: { name: string } | null;
  assignedTrainer?: { name: string } | null;
  emergName?: string | null;
  emergRelationship?: string | null;
  emergMobile?: string | null;
  emergAddress?: string | null;
  memberships?: {
    startDate: Date;
    endDate: Date;
    status: string;
    total: unknown;
    package?: { name: string } | null;
    ptTotal?: unknown;
    ptDurationMonths?: unknown;
    ptStart?: Date | null;
    ptTrainer?: { name: string } | null;
  }[];
  invoices?: {
    invoiceNo: string;
    total: unknown;
    status: string;
    issuedAt: Date;
    allocations?: { amount: unknown }[];
  }[];
  payments?: {
    type?: string;
    method: string;
    amount: unknown;
    paidAt: Date;
    reference?: string | null;
  }[];
}

function dataUrlImage(dataUrl: string): { bytes: Uint8Array; kind: "png" | "jpg" } | null {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  if (m[1] === "webp") return null; // pdf-lib cannot embed WebP
  return { bytes: Uint8Array.from(Buffer.from(m[2], "base64")), kind: m[1] === "png" ? "png" : "jpg" };
}

// ---------- service ----------

@Injectable()
export class PdfService {
  private statusOf(m: { startDate: Date; endDate: Date; status: string }): string {
    return membershipValidity(
      m.startDate.toISOString().slice(0, 10),
      m.endDate.toISOString().slice(0, 10),
      todayInTimezone(process.env.GYM_TIMEZONE ?? "Asia/Kolkata"),
      m.status as "active" | "suspended" | "cancelled",
    );
  }

  /** Branded invoice mirroring the gym's paper layout: header, member & emergency
   *  tables, plan + registration items, totals, PT balance and payment history. */
  async invoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
    const gym = gymIdentity();
    const doc = await PDFDocument.create();
    const canvas = new Page();
    doc.setTitle(`Invoice ${data.invoiceNo}`);
    doc.setAuthor(gym.name);
    canvas.doc = doc;
    canvas.regular = await doc.embedFont(StandardFonts.Helvetica);
    canvas.bold = await doc.embedFont(StandardFonts.HelveticaBold);
    canvas.page = doc.addPage([PAGE_W, PAGE_H]);
    const p = canvas.page;

    // Header band
    p.drawRectangle({ x: 0, y: PAGE_H - 110, width: PAGE_W, height: 110, color: BRAND_BG });
    canvas.y = PAGE_H - 52;
    canvas.text(gym.name.toUpperCase(), MARGIN_X, 22, { bold: true, color: BRAND });
    canvas.y -= 20;
    canvas.text(gym.address || "Fitness for everyone", MARGIN_X, 9, { color: MUTED });
    if (gym.phone) {
      canvas.y -= 12;
      canvas.text(`Phone: ${gym.phone}`, MARGIN_X, 9, { color: MUTED });
    }
    canvas.y = PAGE_H - 52;
    canvas.text("TAX INVOICE", PAGE_W - MARGIN_X - canvas.bold.widthOfTextAtSize("TAX INVOICE", 16), 16, {
      bold: true,
      color: INK,
    });
    canvas.y -= 22;
    canvas.text(data.invoiceNo, PAGE_W - MARGIN_X - canvas.bold.widthOfTextAtSize(data.invoiceNo, 10), 10, {
      bold: true,
      color: MUTED,
    });
    canvas.y -= 14;
    canvas.text(`Date: ${dmy(data.issuedAt)}`, PAGE_W - MARGIN_X - 120, 9, { color: MUTED, width: 120 });
    canvas.y -= 14;
    const statusLabel = data.status.toUpperCase();
    canvas.text(`Status: ${statusLabel}`, PAGE_W - MARGIN_X - 120, 9, { color: MUTED, width: 120 });
    canvas.y = PAGE_H - 122;

    // Member details (two columns)
    canvas.y -= 6;
    canvas.text("Bill To", MARGIN_X, 10, { bold: true, color: BRAND });
    canvas.y -= 15;
    const m = data.member;
    const leftRows: [string, string][] = [
      ["Member ID", m.memberCode],
      ["Name", m.fullName],
      ["DOB", dmy(m.dob)],
      ["Gender", m.gender?.name ?? "—"],
      ["Mobile", m.mobile],
      ["Trainer", m.assignedTrainer?.name ?? "—"],
    ];
    for (const [k, v] of leftRows) {
      canvas.text(k, MARGIN_X, 9, { color: MUTED });
      canvas.text(v, MARGIN_X + 70, 9, { bold: k === "Name" });
      canvas.y -= 13;
    }
    if (m.address) {
      const lines = wrap(m.address, canvas.regular, 9, PAGE_W / 2 - MARGIN_X - 30);
      canvas.text(m.address, MARGIN_X + 70, 9, {});
      canvas.y -= 13 * lines.length;
    }
    let rightY = PAGE_H - 143;
    const drawRight = (label: string, value: string, bold = false) => {
      canvas.page.drawText(label, { x: PAGE_W / 2 + 30, y: rightY, size: 9, font: canvas.regular, color: MUTED });
      canvas.page.drawText(value, { x: PAGE_W / 2 + 110, y: rightY, size: 9, font: canvas.bold, color: bold ? INK : INK });
    };
    drawRight("Membership", data.membership?.package?.name ?? "—");
    drawRight("Period", `${dmy(data.membership?.startDate)} – ${dmy(data.membership?.endDate)}`);
    if (m.emergName) {
      drawRight("Emergency", `${m.emergName} (${emergencyRelationshipLabel(m.emergRelationship)})`);
      drawRight("Contact", m.emergMobile ?? "—");
    }
    if (m.email) {
      rightY -= 13;
      drawRight("Email", m.email.slice(0, 40));
    }

    // Items table
    canvas.y -= 14;
    canvas.y -= 18;
    p.drawRectangle({ x: MARGIN_X, y: canvas.y, width: PAGE_W - 2 * MARGIN_X, height: 18, color: HEAD_BG });
    const cols = { no: MARGIN_X + 6, desc: MARGIN_X + 30, qty: 400, price: 470, amount: PAGE_W - MARGIN_X - 6 };
    canvas.y += 5;
    canvas.text("#", cols.no, 9, { bold: true });
    canvas.text("DESCRIPTION", cols.desc, 9, { bold: true });
    canvas.text("QTY", cols.qty, 9, { bold: true, align: "center", width: 30 });
    canvas.text("PRICE", cols.price, 9, { bold: true, align: "right", width: 55 });
    canvas.text("AMOUNT", cols.amount, 9, { bold: true, align: "right", width: 60 });
    canvas.y -= 5;
    canvas.y -= 19;
    let zebra = false;
    data.items.forEach((item, i) => {
      const lines = wrap(item.label, canvas.regular, 9, cols.qty - 42 - cols.desc);
      canvas.ensure(13 * lines.length + 6);
      if (zebra)
        canvas.page.drawRectangle({
          x: MARGIN_X, y: canvas.y - 3.5, width: PAGE_W - 2 * MARGIN_X, height: 12 * lines.length + 9, color: ZEBRA,
        });
      zebra = !zebra;
      canvas.text(String(i + 1), cols.no, 9);
      lines.forEach((ln, j) => {
        canvas.page.drawText(ln, {
          x: cols.desc,
          y: canvas.y - j * 12,
          size: 9,
          font: canvas.regular,
          color: INK,
        });
      });
      canvas.text(String(item.qty || 1), cols.qty, 9, { align: "center", width: 30 });
      canvas.text(inr(item.unitPrice), cols.price, 9, { align: "right", width: 55 });
      canvas.text(inr(item.amount), cols.amount, 9, { align: "right", width: 60 });
      canvas.y -= 12 * lines.length + 8;
      canvas.hr(LINE);
      canvas.y -= 10;
    });

    // Totals
    canvas.ensure(110);
    const totalRows: [string, string, boolean][] = [
      ["Plan price", inr(data.subtotal), false],
      ...(Number(data.discount) > 0 ? ([["Discount", `- ${inr(data.discount)}`, false]] as [string, string, boolean][]) : []),
      ...(Number(data.gst) > 0 ? ([["GST", inr(data.gst), false]] as [string, string, boolean][]) : []),
      ["Net payable", inr(data.total), true],
      ["Paid", inr(data.paid), false],
      ["Balance due", inr(data.outstanding), data.outstanding > 0],
    ];
    if (data.refunded > 0) totalRows.splice(4, 0, ["Refunded", `- ${inr(data.refunded)}`, false]);
    const boxX = PAGE_W / 2 + 40;
    const boxW = PAGE_W - MARGIN_X - boxX;
    for (const [label, value, strong] of totalRows) {
      if (strong) {
        canvas.page.drawRectangle({ x: boxX, y: canvas.y - 4.5, width: boxW, height: 19, color: HEAD_BG });
        canvas.text(label, boxX + 8, 10, { bold: true });
        canvas.text(value, boxX + 8, 10, { bold: true, align: "right", width: boxW - 16 });
        canvas.y -= 22;
      } else {
        canvas.text(label, boxX + 8, 9, { color: MUTED });
        canvas.text(value, boxX + 8, 9, { align: "right", width: boxW - 16 });
        canvas.y -= 15;
      }
    }
    canvas.y -= 4;
    canvas.text(amountInWords(Number(data.total)), MARGIN_X, 9, { bold: true, color: MUTED });
    canvas.y -= 24;

    // PT section
    const ptTotal = Number(data.membership?.ptTotal ?? 0);
    if (ptTotal > 0) {
      canvas.ensure(64);
      const ms = data.membership!;
      const ptEnd = ptEndDate(
        ms.ptStart ? ms.ptStart.toISOString().slice(0, 10) : null,
        Number(ms.ptDurationMonths ?? 0),
      );
      canvas.page.drawRectangle({
        x: MARGIN_X, y: canvas.y - 52, width: PAGE_W - 2 * MARGIN_X, height: 56, color: BRAND_BG,
        borderColor: BRAND, borderWidth: 0.8,
      });
      canvas.y -= 6;
      canvas.text("PERSONAL TRAINING", MARGIN_X + 10, 9, { bold: true, color: BRAND });
      canvas.y -= 14;
      canvas.text("Trainer", MARGIN_X + 10, 9, { color: MUTED });
      canvas.text(ms.ptTrainer?.name ?? "—", MARGIN_X + 70, 9, { bold: true });
      canvas.text("Duration", PAGE_W / 2 - 10, 9, { color: MUTED });
      canvas.text(`${Number(ms.ptDurationMonths ?? 0)} month(s)`, PAGE_W / 2 + 40, 9, { bold: true });
      canvas.text("Period", MARGIN_X + 200, 9, { color: MUTED });
      canvas.text(`${dmy(ms.ptStart)} – ${ptEnd ? dmy(ptEnd) : "—"}`, MARGIN_X + 240, 9);
      canvas.y -= 14;
      canvas.text("PT package", MARGIN_X + 10, 10, { color: MUTED });
      canvas.text(inr(ptTotal), MARGIN_X + 90, 10, { bold: true });
      canvas.y--;
    }

    // Payment history
    const pays = (data.allocations ?? [])
      .filter((a) => !!a.payment)
      .map((a) => ({ ...a.payment!, amount: Number(a.amount) }));
    if (pays.length > 0) {
      canvas.ensure(30 + pays.length * 14);
      canvas.y -= 12;
      canvas.text("Payments applied", MARGIN_X, 10, { bold: true, color: BRAND });
      canvas.y -= 14;
      canvas.text("Date", MARGIN_X + 6, 9, { color: MUTED });
      canvas.text("Method", MARGIN_X + 90, 9, { color: MUTED });
      canvas.text("Reference", MARGIN_X + 200, 9, { color: MUTED });
      canvas.text("Amount", PAGE_W - MARGIN_X - 6, 9, { color: MUTED, align: "right", width: 70 });
      canvas.y -= 14;
      canvas.hr();
      canvas.y -= 13;
      for (const pay of pays) {
        canvas.text(dmy(pay.paidAt), MARGIN_X + 6, 9);
        canvas.text(pay.method, MARGIN_X + 90, 9);
        canvas.text((pay.reference ?? "").slice(0, 40), MARGIN_X + 200, 9, { color: MUTED });
        canvas.text(inr(pay.amount), PAGE_W - MARGIN_X - 6, 9, { align: "right", width: 70 });
        canvas.y -= 13;
      }
    }

    // Footer — thank-you + sign-off
    canvas.ensure(92);
    canvas.y -= 8;
    canvas.page.drawRectangle({
      x: MARGIN_X, y: canvas.y - 30, width: PAGE_W - 2 * MARGIN_X, height: 32,
      color: rgb(0.98, 0.99, 0.99), borderColor: LINE, borderWidth: 0.8,
    });
    canvas.y -= 10;
    canvas.text(`Thank you for choosing ${gym.name}!`, MARGIN_X + 10, 10, { bold: true, color: BRAND });
    canvas.y -= 40;
    canvas.text(`For ${gym.name},`, MARGIN_X, 9, { color: MUTED });
    canvas.y -= 34;
    canvas.hr();
    canvas.y -= 12;
    canvas.text(gym.founder, MARGIN_X, 9, { bold: true });
    canvas.text("Authorised Signatory", PAGE_W - MARGIN_X - 110, 9, { color: MUTED, width: 110 });
    canvas.y -= 16;
    canvas.text(
      `Generated on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
      MARGIN_X, 7.5, { color: MUTED },
    );
    return doc.save();
  }

  /** Member profile sheet: photo, status + days remaining, plan box, personal
   *  info grid, emergency contact, membership/PT and invoice/payment history. */
  async memberProfilePdf(data: MemberPdfData): Promise<Uint8Array> {
    const gym = gymIdentity();
    const doc = await PDFDocument.create();
    const canvas = new Page();
    doc.setTitle(`Member ${data.memberCode} — ${data.fullName}`);
    doc.setAuthor(gym.name);
    canvas.doc = doc;
    canvas.regular = await doc.embedFont(StandardFonts.Helvetica);
    canvas.bold = await doc.embedFont(StandardFonts.HelveticaBold);
    canvas.page = doc.addPage([PAGE_W, PAGE_H]);
    const p = canvas.page;

    // Header band
    p.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 96, color: BRAND_BG });
    canvas.y = PAGE_H - 50;
    canvas.text(gym.name.toUpperCase(), MARGIN_X, 20, { bold: true, color: BRAND });
    canvas.y -= 18;
    canvas.text(gym.address || "", MARGIN_X, 9, { color: MUTED });
    if (gym.phone) {
      canvas.y -= 12;
      canvas.text(`Phone: ${gym.phone}`, MARGIN_X, 9, { color: MUTED });
    }
    canvas.y = PAGE_H - 48;
    canvas.text("MEMBER PROFILE", PAGE_W - MARGIN_X - canvas.bold.widthOfTextAtSize("MEMBER PROFILE", 13), 13, {
      bold: true, color: INK,
    });
    canvas.y = PAGE_H - 108;

    // Photo (right)
    const img = data.photoUrl ? dataUrlImage(data.photoUrl) : null;
    let imgW = 0;
    if (img) {
      try {
        const embedded =
          img.kind === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
        const h = 110;
        const w = Math.min(110, (embedded.width / embedded.height) * h);
        p.drawRectangle({
          x: PAGE_W - MARGIN_X - w - 2, y: PAGE_H - 112 - h, width: w + 4, height: h + 4,
          color: rgb(1, 1, 1), borderColor: LINE, borderWidth: 1,
        });
        p.drawImage(embedded, { x: PAGE_W - MARGIN_X - w, y: PAGE_H - 110 - h, width: w, height: h });
        imgW = w;
      } catch {
        // broken image data — render without the photo
      }
    }

    // Name + status badge
    const nameLines = wrap(data.fullName, canvas.bold, 20, PAGE_W - 2 * MARGIN_X - imgW - 30);
    for (const ln of nameLines) {
      canvas.text(ln, MARGIN_X, 20, { bold: true });
      canvas.y -= 24;
    }
    canvas.text(data.memberCode, MARGIN_X, 11, { color: MUTED });
    canvas.y -= 16;
    const validity = data.memberships?.[0] ? this.statusOf(data.memberships[0]) : "none";
    const badge = validity.toUpperCase();
    const badgeW = canvas.bold.widthOfTextAtSize(badge, 9) + 16;
    canvas.page.drawRectangle({
      x: MARGIN_X, y: canvas.y - 3, width: badgeW, height: 15, color: BADGE_BG,
    });
    canvas.text(badge, MARGIN_X + 8, 9, { bold: true });
    const first = data.memberships?.[0];
    if (first) {
      const end = first.endDate.toISOString().slice(0, 10);
      const today = todayInTimezone(process.env.GYM_TIMEZONE ?? "Asia/Kolkata");
      const days = diffDays(today, end);
      const note =
        first.status === "active"
          ? days >= 0
            ? `${days} day(s) remaining`
            : `expired ${Math.abs(days)} day(s) ago`
          : first.status;
      canvas.text(note, MARGIN_X + badgeW + 10, 9, { color: MUTED });
    }
    canvas.y -= 24;

    // Personal info grid
    const grid: [string, string][] = [
      ["DOB", dmy(data.dob)],
      ["Gender", data.gender?.name ?? "—"],
      ["Mobile", data.mobile],
      ["Email", data.email ?? "—"],
      ["Registered", dmy(data.registrationDate)],
      ["Source", data.source ?? "—"],
      ["Trainer", data.assignedTrainer?.name ?? "—"],
      ["Member ID", data.memberCode],
    ];
    canvas.hr();
    canvas.y -= 16;
    canvas.text("PERSONAL INFORMATION", MARGIN_X, 10, { bold: true, color: BRAND });
    canvas.y -= 17;
    for (let i = 0; i < grid.length; i += 2) {
      canvas.ensure(15);
      const [k1, v1] = grid[i];
      const [k2, v2] = grid[i + 1] ?? ["", ""];
      canvas.text(k1, MARGIN_X, 9, { color: MUTED });
      canvas.text(v1.slice(0, 45), MARGIN_X + 85, 9, { bold: true });
      if (k2) {
        canvas.text(k2, PAGE_W / 2 + 20, 9, { color: MUTED });
        canvas.text(v2.slice(0, 45), PAGE_W / 2 + 105, 9, { bold: true });
      }
      canvas.y -= 15;
    }
    if (data.address) {
      canvas.text("Address", MARGIN_X, 9, { color: MUTED });
      const lines = wrap(data.address, canvas.regular, 9, PAGE_W - 2 * MARGIN_X - 85);
      lines.forEach((ln, j) => {
        canvas.page.drawText(ln, { x: MARGIN_X + 85, y: canvas.y - j * 12, size: 9, font: canvas.regular, color: INK });
      });
      canvas.y -= 12 * lines.length + 4;
    }

    // Membership / plan box
    if (first) {
      canvas.ensure(76);
      canvas.y -= 10;
      const boxH = 74;
      canvas.page.drawRectangle({
        x: MARGIN_X, y: canvas.y - boxH + 10, width: PAGE_W - 2 * MARGIN_X, height: boxH,
        color: HEAD_BG, borderColor: LINE, borderWidth: 0.8,
      });
      canvas.text("CURRENT PLAN", MARGIN_X + 10, 10, { bold: true, color: BRAND });
      canvas.y -= 18;
      canvas.text(first.package?.name ?? "—", MARGIN_X + 10, 11, { bold: true });
      canvas.text(`Period ${dmy(first.startDate)} – ${dmy(first.endDate)}`, MARGIN_X + 10, 9, { color: MUTED });
      canvas.y -= 14;
      canvas.text("Plan total", MARGIN_X + 10, 9, { color: MUTED });
      canvas.text(inr(first.total), MARGIN_X + 70, 9, { bold: true });
      canvas.text("Status", MARGIN_X + 200, 9, { color: MUTED });
      canvas.text(validity.toUpperCase(), MARGIN_X + 240, 9, { bold: true });
      const ptTotal = Number(first.ptTotal ?? 0);
      if (ptTotal > 0) {
        canvas.text("PT", PAGE_W / 2 + 110, 9, { color: MUTED });
        const ptEnd = ptEndDate(
          first.ptStart ? first.ptStart.toISOString().slice(0, 10) : null,
          Number(first.ptDurationMonths ?? 0),
        );
        canvas.text(
          `${inr(ptTotal)} · ${Number(first.ptDurationMonths ?? 0)}m · ${dmy(first.ptStart)} – ${ptEnd ? dmy(ptEnd) : "—"} · ${first.ptTrainer?.name ?? "—"}`,
          PAGE_W / 2 + 135, 9, { bold: true },
        );
      }
      canvas.y -= boxH - 8;
    } else {
      canvas.y -= 16;
      canvas.text("No membership yet", MARGIN_X, 9, { color: MUTED });
    }

    // Emergency contact
    canvas.y -= 14;
    canvas.hr();
    canvas.y -= 16;
    canvas.text("EMERGENCY CONTACT", MARGIN_X, 10, { bold: true, color: BRAND });
    canvas.y -= 17;
    if (data.emergName) {
      canvas.text("Name", MARGIN_X, 9, { color: MUTED });
      canvas.text(data.emergName, MARGIN_X + 85, 9, { bold: true });
      canvas.text(
        emergencyRelationshipLabel(data.emergRelationship) || "—",
        PAGE_W / 2 + 20, 9, { color: MUTED },
      );
      canvas.y -= 14;
      canvas.text("Mobile", MARGIN_X, 9, { color: MUTED });
      canvas.text(data.emergMobile ?? "—", MARGIN_X + 85, 9, { bold: true });
      const addr = data.emergAddress
        ? wrap(data.emergAddress, canvas.regular, 9, PAGE_W / 2 - 60)
        : ["—"];
      canvas.page.drawText("Address", { x: PAGE_W / 2 + 20, y: canvas.y, size: 9, font: canvas.regular, color: MUTED });
      addr.forEach((ln, j) => {
        canvas.page.drawText(ln, { x: PAGE_W / 2 + 105, y: canvas.y - j * 12, size: 9, font: canvas.regular, color: INK });
      });
      canvas.y -= 12 * addr.length + 4;
    } else {
      canvas.text("Not recorded", MARGIN_X, 9, { color: MUTED });
      canvas.y -= 14;
    }

    // Invoices
    const invoices = data.invoices ?? [];
    if (invoices.length > 0) {
      canvas.ensure(60);
      canvas.y -= 14;
      canvas.hr();
      canvas.y -= 16;
      canvas.text("INVOICES", MARGIN_X, 10, { bold: true, color: BRAND });
      canvas.y -= 17;
      canvas.text("Invoice", MARGIN_X + 6, 9, { color: MUTED });
      canvas.text("Date", MARGIN_X + 110, 9, { color: MUTED });
      canvas.text("Total", 330, 9, { color: MUTED, align: "right", width: 60 });
      canvas.text("Paid", 400, 9, { color: MUTED, align: "right", width: 60 });
      canvas.text("Balance", 470, 9, { color: MUTED, align: "right", width: 60 });
      canvas.text("Status", PAGE_W - MARGIN_X - 6, 9, { color: MUTED, align: "right", width: 45 });
      canvas.y -= 14;
      canvas.hr();
      canvas.y -= 13;
      for (const inv of invoices) {
        canvas.ensure(14);
        const paid = round2((inv.allocations ?? []).reduce((n, a) => n + Number(a.amount), 0));
        canvas.text(inv.invoiceNo, MARGIN_X + 6, 9);
        canvas.text(dmy(inv.issuedAt), MARGIN_X + 110, 9);
        canvas.text(inr(inv.total), 330, 9, { align: "right", width: 60 });
        canvas.text(inr(paid), 400, 9, { align: "right", width: 60 });
        canvas.text(inr(invoiceOutstanding(Number(inv.total), paid)), 470, 9, { align: "right", width: 60 });
        canvas.text(inv.status, PAGE_W - MARGIN_X - 6, 9, { align: "right", width: 45, color: MUTED });
        canvas.y -= 13;
      }
    }

    // Payment history
    const payments = data.payments ?? [];
    if (payments.length > 0) {
      canvas.ensure(40 + Math.min(payments.length, 12) * 13);
      canvas.y -= 14;
      canvas.hr();
      canvas.y -= 16;
      canvas.text("RECENT PAYMENTS", MARGIN_X, 10, { bold: true, color: BRAND });
      canvas.y -= 17;
      canvas.text("Date", MARGIN_X + 6, 9, { color: MUTED });
      canvas.text("For", MARGIN_X + 90, 9, { color: MUTED });
      canvas.text("Method", MARGIN_X + 150, 9, { color: MUTED });
      canvas.text("Reference", MARGIN_X + 260, 9, { color: MUTED });
      canvas.text("Amount", PAGE_W - MARGIN_X - 6, 9, { color: MUTED, align: "right", width: 70 });
      canvas.y -= 14;
      canvas.hr();
      canvas.y -= 13;
      for (const pay of payments) {
        canvas.ensure(14);
        canvas.text(dmy(pay.paidAt), MARGIN_X + 6, 9);
        canvas.text(pay.type === "pt" ? "PT" : "Membership", MARGIN_X + 90, 9);
        canvas.text(pay.method, MARGIN_X + 150, 9);
        canvas.text((pay.reference ?? "").slice(0, 30), MARGIN_X + 260, 9, { color: MUTED });
        canvas.text(inr(pay.amount), PAGE_W - MARGIN_X - 6, 9, { align: "right", width: 70 });
        canvas.y -= 13;
      }
    }

    if (data.notes) {
      canvas.ensure(30);
      canvas.y -= 14;
      canvas.hr();
      canvas.y -= 16;
      canvas.text("NOTES", MARGIN_X, 9, { bold: true, color: BRAND });
      canvas.y -= 13;
      const lines = wrap(data.notes, canvas.regular, 8.5, PAGE_W - 2 * MARGIN_X);
      for (const ln of lines.slice(0, 6)) {
        canvas.text(ln, MARGIN_X, 8.5, { color: MUTED });
        canvas.y -= 11;
      }
    }

    // Footer
    canvas.ensure(30);
    canvas.y -= 10;
    canvas.hr();
    canvas.y -= 12;
    canvas.text(`Generated on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, MARGIN_X, 7.5, {
      color: MUTED,
    });
    canvas.text(gym.founder, PAGE_W - MARGIN_X - 110, 7.5, { color: MUTED, width: 110, align: "right" });
    return doc.save();
  }
}
