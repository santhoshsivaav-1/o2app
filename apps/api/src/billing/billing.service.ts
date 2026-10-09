import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { invoiceOutstanding, paymentMethod, recomputeInvoiceStatus, round2 } from "@o2app/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import {
  CreatePaymentDto,
  InvoiceListQuery,
  PaymentListQuery,
  RefundDto,
  ReportRangeQuery,
} from "./dto.js";

const num = (v: unknown) => Number(v ?? 0);

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- helpers ----------

  private async byIdempotency(key: string | undefined) {
    if (!key) return null;
    return this.prisma.payment.findUnique({
      where: { idempotencyKey: key },
      include: {
        allocations: {
          include: { invoice: { select: { id: true, invoiceNo: true, total: true } } },
        },
        member: { select: { id: true, memberCode: true, fullName: true } },
      },
    });
  }

  private async invoiceTotals(invoiceId: string) {
    const [paid, refunded] = await this.prisma.$transaction([
      this.prisma.paymentAllocation.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
      this.prisma.refund.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
    ]);
    return { paid: num(paid._sum.amount), refunded: num(refunded._sum.amount) };
  }

  private async refreshInvoiceStatus(tx: Prisma.TransactionClient, invoiceId: string) {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) return;
    const paid = await tx.paymentAllocation.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });
    const refunded = await tx.refund.aggregate({ where: { invoiceId }, _sum: { amount: true } });
    const status = recomputeInvoiceStatus(
      num(inv.total),
      num(paid._sum.amount),
      num(refunded._sum.amount),
    );
    if (status !== inv.status)
      await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  }

  // ---------- payments ----------

  async recordPayment(dto: CreatePaymentDto, actorId: string) {
    // Single response shape on every path: { payment, credit, idempotentReplay }.
    const replay = await this.byIdempotency(dto.idempotencyKey);
    if (replay) return { payment: replay, credit: null, idempotentReplay: true };

    const method = paymentMethod(dto.method);
    if (!method) throw new BadRequestException(`Unknown payment method: ${dto.method}`);
    if (method.needsReference && !dto.reference?.trim())
      throw new BadRequestException(`${method.label} requires a transaction reference`);
    const member = await this.prisma.member.findUnique({ where: { id: dto.memberId } });
    if (!member) throw new NotFoundException("Member not found");
    const amount = round2(dto.amount);
    if (!(amount > 0)) throw new BadRequestException("Amount must be positive");

    const allocations = dto.allocations ?? [];
    const seen = new Set<string>();
    let allocSum = 0;
    const validated: { invoiceId: string; amount: number; total: number }[] = [];
    for (const a of allocations) {
      if (seen.has(a.invoiceId)) throw new BadRequestException("Duplicate invoice in allocations");
      seen.add(a.invoiceId);
      const inv = await this.prisma.invoice.findUnique({ where: { id: a.invoiceId } });
      if (!inv) throw new NotFoundException("Invoice not found");
      if (inv.memberId !== member.id)
        throw new BadRequestException("Invoice belongs to a different member");
      const amt = round2(a.amount);
      if (!(amt > 0)) throw new BadRequestException("Allocation amounts must be positive");
      const { paid } = await this.invoiceTotals(inv.id);
      const outstanding = invoiceOutstanding(num(inv.total), paid);
      if (round2(amt) > round2(outstanding) + 1e-9)
        throw new BadRequestException(
          `Allocation ${amt} exceeds outstanding ${outstanding} on ${inv.invoiceNo}`,
        );
      allocSum = round2(allocSum + amt);
      validated.push({ invoiceId: inv.id, amount: amt, total: num(inv.total) });
    }
    if (allocSum > amount + 1e-9)
      throw new BadRequestException("Allocations exceed the payment amount");

    const paidAt = dto.paidAt ? new Date(dto.paidAt + "T00:00:00Z") : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException("Invalid paidAt");

    // A double-submit race can pass the replay check above in both requests;
    // the unique constraint decides the winner and the loser replays it.
    const created = await this.prisma
      .$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            memberId: member.id,
            method: method.key,
            amount,
            paidAt,
            reference: dto.reference?.trim() || null,
            verified: false, // manually recorded — never gateway-confirmed
            idempotencyKey: dto.idempotencyKey,
            receivedById: actorId,
            allocations: {
              create: validated.map((v) => ({ invoiceId: v.invoiceId, amount: v.amount })),
            },
          },
          include: {
            allocations: {
              include: { invoice: { select: { id: true, invoiceNo: true, total: true } } },
            },
            member: { select: { id: true, memberCode: true, fullName: true } },
          },
        });
        for (const v of validated) await this.refreshInvoiceStatus(tx, v.invoiceId);
        const remainder = round2(amount - allocSum);
        let credit = null;
        if (remainder > 0) {
          credit = await tx.creditAdjustment.create({
            data: {
              memberId: member.id,
              amount: remainder,
              remaining: remainder,
              sourcePaymentId: payment.id,
              note: "Overpayment / advance — apply to a future invoice",
              createdById: actorId,
            },
          });
        }
        return { payment, credit, idempotentReplay: false };
      })
      .catch(async (e) => {
        if (
          dto.idempotencyKey &&
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code: string }).code === "P2002"
        ) {
          const winner = await this.byIdempotency(dto.idempotencyKey);
          if (winner) return { payment: winner, credit: null, idempotentReplay: true };
        }
        throw e;
      });
    await this.audit.log("payments.collect", "payment", created.payment.id, actorId);
    return created;
  }

  async getPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, memberCode: true, fullName: true, mobile: true } },
        allocations: {
          include: { invoice: { select: { id: true, invoiceNo: true, total: true } } },
        },
        refunds: true,
        credits: true,
      },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    const refunded = payment.refunds.reduce((n, r) => round2(n + num(r.amount)), 0);
    return { ...payment, refunded };
  }

  async listPayments(query: PaymentListQuery & { page?: string; limit?: string }) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20) || 20));
    const where: Record<string, unknown> = {};
    if (query.memberId) where.memberId = query.memberId;
    if (query.method) where.method = query.method;
    if (query.from || query.to) {
      where.paidAt = {
        gte: query.from ? new Date(query.from + "T00:00:00Z") : undefined,
        lte: query.to ? new Date(query.to + "T23:59:59Z") : undefined,
      };
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.payment.count({ where: where as never }),
      this.prisma.payment.findMany({
        where: where as never,
        orderBy: { paidAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          member: { select: { id: true, memberCode: true, fullName: true } },
          allocations: { select: { amount: true } },
        },
      }),
    ]);
    return { data, meta: { page, limit, total } };
  }

  async refund(id: string, dto: RefundDto, actorId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { refunds: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    const already = payment.refunds.reduce((n, r) => round2(n + num(r.amount)), 0);
    const amount = round2(dto.amount);
    if (!(amount > 0)) throw new BadRequestException("Refund amount must be positive");
    if (round2(already + amount) > num(payment.amount) + 1e-9)
      throw new BadRequestException(
        `Refund exceeds refundable balance (${round2(num(payment.amount) - already)})`,
      );
    let invoiceId: string | null = null;
    if (dto.invoiceId) {
      const inv = await this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } });
      if (!inv) throw new NotFoundException("Invoice not found");
      if (inv.memberId !== payment.memberId)
        throw new BadRequestException("Invoice belongs to a different member");
      invoiceId = inv.id;
    }
    const refund = await this.prisma.$transaction(async (tx) => {
      const row = await tx.refund.create({
        data: {
          paymentId: payment.id,
          invoiceId,
          amount,
          reason: dto.reason.trim(),
          createdById: actorId,
        },
      });
      const touched = new Set<string>();
      const allocs = await tx.paymentAllocation.findMany({ where: { paymentId: payment.id } });
      for (const a of allocs) touched.add(a.invoiceId);
      if (invoiceId) touched.add(invoiceId);
      for (const invId of touched) await this.refreshInvoiceStatus(tx, invId);
      return row;
    });
    await this.audit.log("payments.refund", "payment", payment.id, actorId);
    return refund;
  }

  // ---------- invoices ----------

  async getInvoice(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, memberCode: true, fullName: true, mobile: true } },
        membership: { select: { id: true, startDate: true, endDate: true, status: true } },
        items: true,
        allocations: {
          include: {
            payment: { select: { id: true, method: true, paidAt: true, reference: true } },
          },
        },
        refunds: true,
      },
    });
    if (!inv) throw new NotFoundException("Invoice not found");
    const paid = inv.allocations.reduce((n, a) => round2(n + num(a.amount)), 0);
    const refunded = inv.refunds.reduce((n, r) => round2(n + num(r.amount)), 0);
    return {
      ...inv,
      paid,
      refunded,
      outstanding: invoiceOutstanding(num(inv.total), paid),
    };
  }

  async listInvoices(query: InvoiceListQuery & { page?: string; limit?: string }) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20) || 20));
    const where: Record<string, unknown> = {};
    if (query.memberId) where.memberId = query.memberId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.issuedAt = {
        gte: query.from ? new Date(query.from + "T00:00:00Z") : undefined,
        lte: query.to ? new Date(query.to + "T23:59:59Z") : undefined,
      };
    }
    if (query.q) where.invoiceNo = { contains: query.q.trim(), mode: "insensitive" };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where: where as never }),
      this.prisma.invoice.findMany({
        where: where as never,
        orderBy: { issuedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          member: { select: { id: true, memberCode: true, fullName: true } },
          allocations: { select: { amount: true } },
          refunds: { select: { amount: true } },
        },
      }),
    ]);
    return {
      data: data.map((inv) => {
        const paid = inv.allocations.reduce((n, a) => round2(n + num(a.amount)), 0);
        const refunded = inv.refunds.reduce((n, r) => round2(n + num(r.amount)), 0);
        return { ...inv, paid, refunded, outstanding: invoiceOutstanding(num(inv.total), paid) };
      }),
      meta: { page, limit, total },
    };
  }

  // ---------- reports (financial reads; Phase 8 adds the rest) ----------

  private range(query: ReportRangeQuery) {
    if (query.from > query.to) throw new BadRequestException("from must be on/before to");
    return {
      from: new Date(query.from + "T00:00:00Z"),
      to: new Date(query.to + "T23:59:59Z"),
    };
  }

  async collections(query: ReportRangeQuery) {
    const { from, to } = this.range(query);
    const payments = await this.prisma.payment.findMany({
      where: { paidAt: { gte: from, lte: to } },
      select: { paidAt: true, method: true, amount: true },
    });
    const refunds = await this.prisma.refund.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true, amount: true },
    });
    const days: Record<
      string,
      { paid: number; refunded: number; byMethod: Record<string, number> }
    > = {};
    const dayOf = (d: Date) => d.toISOString().slice(0, 10);
    for (const p of payments) {
      const d = (days[dayOf(p.paidAt)] ??= { paid: 0, refunded: 0, byMethod: {} });
      const amt = num(p.amount);
      d.paid = round2(d.paid + amt);
      d.byMethod[p.method] = round2((d.byMethod[p.method] ?? 0) + amt);
    }
    for (const r of refunds) {
      const d = (days[dayOf(r.createdAt)] ??= { paid: 0, refunded: 0, byMethod: {} });
      d.refunded = round2(d.refunded + num(r.amount));
    }
    const rows = Object.entries(days)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, ...v, net: round2(v.paid - v.refunded) }));
    const totals = rows.reduce(
      (t, r) => ({
        paid: round2(t.paid + r.paid),
        refunded: round2(t.refunded + r.refunded),
        net: round2(t.net + r.net),
      }),
      { paid: 0, refunded: 0, net: 0 },
    );
    return { from: query.from, to: query.to, days: rows, totals };
  }

  async outstandingList() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: ["unpaid", "partial"] } },
      include: {
        member: { select: { id: true, memberCode: true, fullName: true, mobile: true } },
        allocations: { select: { amount: true } },
      },
      orderBy: { issuedAt: "asc" },
      take: 500,
    });
    return invoices
      .map((inv) => {
        const paid = inv.allocations.reduce((n, a) => round2(n + num(a.amount)), 0);
        return {
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          member: inv.member,
          total: num(inv.total),
          paid,
          outstanding: invoiceOutstanding(num(inv.total), paid),
          status: inv.status,
          issuedAt: inv.issuedAt,
        };
      })
      .filter((r) => r.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
  }

  async refundsReport(query: ReportRangeQuery) {
    const { from, to } = this.range(query);
    const rows = await this.prisma.refund.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      include: {
        payment: {
          select: {
            id: true,
            method: true,
            member: { select: { id: true, memberCode: true, fullName: true } },
          },
        },
        invoice: { select: { id: true, invoiceNo: true } },
      },
    });
    const total = rows.reduce((n, r) => round2(n + num(r.amount)), 0);
    return { from: query.from, to: query.to, total, data: rows };
  }

  // ---------- CSV exports ----------

  private esc(v: unknown): string {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
  }

  async exportPayments(query: PaymentListQuery) {
    const { data } = await this.listPayments({ ...query, page: "1", limit: "5000" });
    const rows = (data as Record<string, unknown>[]).map((p) =>
      [
        (p.member as Record<string, unknown>).memberCode,
        (p.member as Record<string, unknown>).fullName,
        p.method,
        p.amount,
        (p.paidAt as Date).toISOString(),
        p.reference ?? "",
        p.verified ? "gateway-verified" : "manual",
      ]
        .map((v) => this.esc(v))
        .join(","),
    );
    return ["member_code,member_name,method,amount,paid_at,reference,verification", ...rows].join(
      "\n",
    );
  }

  async exportInvoices(query: InvoiceListQuery) {
    const { data } = await this.listInvoices({ ...query, page: "1", limit: "5000" });
    const rows = (data as Record<string, unknown>[]).map((p) =>
      [
        p.invoiceNo,
        (p.member as Record<string, unknown>).memberCode,
        (p.member as Record<string, unknown>).fullName,
        p.subtotal,
        p.discount,
        p.taxable,
        p.gst,
        p.total,
        p.paid,
        p.refunded,
        p.outstanding,
        p.status,
      ]
        .map((v) => this.esc(v))
        .join(","),
    );
    return [
      "invoice_no,member_code,member_name,subtotal,discount,taxable,gst,total,paid,refunded,outstanding,status",
      ...rows,
    ].join("\n");
  }

  async exportCollections(query: ReportRangeQuery) {
    const rep = await this.collections(query);
    const methods = [...new Set(rep.days.flatMap((d) => Object.keys(d.byMethod)))].sort();
    const header = ["date", "paid", "refunded", "net", ...methods.map((m) => `paid_${m}`)].join(
      ",",
    );
    const rows = rep.days.map((d) =>
      [d.date, d.paid, d.refunded, d.net, ...methods.map((m) => d.byMethod[m] ?? 0)].join(","),
    );
    return [header, ...rows].join("\n");
  }

  async exportOutstanding() {
    const rows = await this.outstandingList();
    const lines = rows.map((r) =>
      [
        r.invoiceNo,
        r.member.memberCode,
        r.member.fullName,
        r.member.mobile,
        r.total,
        r.paid,
        r.outstanding,
        r.status,
      ]
        .map((v) => this.esc(v))
        .join(","),
    );
    return [
      "invoice_no,member_code,member_name,mobile,total,paid,outstanding,status",
      ...lines,
    ].join("\n");
  }
}
