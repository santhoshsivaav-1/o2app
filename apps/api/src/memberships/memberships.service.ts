import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  addDays,
  calcInvoice,
  diffDays,
  formatInvoiceNo,
  membershipValidity,
  renewalStartDate,
  todayInTimezone,
} from "@o2app/shared";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import {
  CancelDto,
  CreateMembershipDto,
  ExtendDto,
  MembershipListQuery,
  RenewMembershipDto,
  SuspendDto,
} from "./dto.js";

const SORTABLE = new Set(["startDate", "endDate", "createdAt"]);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface Pricing {
  price: number;
  registrationFee: number;
  discountPct: number;
  discountAmount: number;
  gstPercent: number;
  gstAmount: number;
  taxable: number;
  total: number;
  durationDays: number;
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private today(): string {
    return todayInTimezone(process.env.GYM_TIMEZONE ?? "Asia/Kolkata");
  }

  private defaultGst(): number {
    return Number(process.env.GST_DEFAULT_PCT ?? 18);
  }

  private price(
    pkg: {
      price: unknown;
      registrationFee: unknown;
      discountMaxPct: unknown;
      gstPercent: unknown;
      durationDays: number;
    },
    discountPct: number,
  ): Pricing {
    const price = Number(pkg.price);
    const registrationFee = Number(pkg.registrationFee);
    const maxPct =
      pkg.discountMaxPct === null || pkg.discountMaxPct === undefined
        ? 100
        : Number(pkg.discountMaxPct);
    if (discountPct < 0 || discountPct > 100)
      throw new BadRequestException("Discount must be 0–100%");
    if (discountPct > maxPct)
      throw new BadRequestException(`Discount exceeds package maximum of ${maxPct}%`);
    const subtotal = round2(price + registrationFee);
    const discountAmount = round2((subtotal * discountPct) / 100);
    const gstPercent =
      pkg.gstPercent === null || pkg.gstPercent === undefined
        ? this.defaultGst()
        : Number(pkg.gstPercent);
    const calc = calcInvoice({ subtotal, discount: discountAmount, gstPercent });
    return {
      price,
      registrationFee,
      discountPct,
      discountAmount,
      gstPercent,
      gstAmount: calc.gst,
      taxable: calc.taxable,
      total: calc.total,
      durationDays: pkg.durationDays,
    };
  }

  private async nextInvoiceNo(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const counter = await this.prisma.seqCounter.upsert({
      where: { name_year: { name: "invoice", year } },
      create: { name: "invoice", year, last: 1 },
      update: { last: { increment: 1 } },
    });
    return formatInvoiceNo(year, counter.last);
  }

  private async byIdempotency(key: string | undefined) {
    if (!key) return null;
    return this.prisma.membership.findUnique({
      where: { idempotencyKey: key },
      include: { invoice: { include: { items: true } }, member: true, package: true },
    });
  }

  private endOf(start: string, durationDays: number): string {
    return addDays(start, durationDays - 1);
  }

  async create(dto: CreateMembershipDto, actorId: string) {
    const existing = await this.byIdempotency(dto.idempotencyKey);
    if (existing) return { ...existing, idempotentReplay: true };

    const member = await this.prisma.member.findUnique({ where: { id: dto.memberId } });
    if (!member) throw new NotFoundException("Member not found");
    if (member.status === "archived")
      throw new ConflictException(
        "Member is archived — restore the profile before selling a membership",
      );
    const pkg = await this.prisma.package.findUnique({ where: { id: dto.packageId } });
    if (!pkg) throw new NotFoundException("Package not found");
    if (!pkg.isActive)
      throw new ConflictException("Package is inactive and cannot be sold for a new membership");

    const start = dto.startDate ?? this.today();
    const pricing = this.price(pkg, dto.discountPct ?? 0);
    const end = this.endOf(start, pricing.durationDays);
    const invoiceNo = await this.nextInvoiceNo();

    const created = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: {
          memberId: member.id,
          packageId: pkg.id,
          startDate: new Date(start + "T00:00:00Z"),
          endDate: new Date(end + "T00:00:00Z"),
          status: "active",
          price: pricing.price,
          registrationFee: pricing.registrationFee,
          discountPct: pricing.discountPct,
          discountAmount: pricing.discountAmount,
          gstPercent: pricing.gstPercent,
          gstAmount: pricing.gstAmount,
          total: pricing.total,
          notes: dto.notes?.trim() || null,
          idempotencyKey: dto.idempotencyKey,
          createdById: actorId,
          invoice: {
            create: {
              invoiceNo,
              memberId: member.id,
              subtotal: pricing.price + pricing.registrationFee,
              discount: pricing.discountAmount,
              taxable: pricing.taxable,
              gst: pricing.gstAmount,
              total: pricing.total,
              status: "unpaid",
              createdById: actorId,
              items: {
                create: [
                  {
                    label: `${pkg.name} (${pkg.durationValue} ${pkg.durationUnit})`,
                    qty: 1,
                    unitPrice: pricing.price,
                    amount: pricing.price,
                  },
                  ...(pricing.registrationFee > 0
                    ? [
                        {
                          label: "Registration fee",
                          qty: 1,
                          unitPrice: pricing.registrationFee,
                          amount: pricing.registrationFee,
                        },
                      ]
                    : []),
                ],
              },
            },
          },
          statusHistory: { create: { from: "none", to: "active", actorId, reason: "sale" } },
        },
        include: { invoice: { include: { items: true } }, member: true, package: true },
      });
      return membership;
    });
    await this.audit.log("memberships.create", "membership", created.id, actorId);
    return created;
  }

  async renew(id: string, dto: RenewMembershipDto, actorId: string) {
    const existing = await this.byIdempotency(dto.idempotencyKey);
    if (existing) return { ...existing, idempotentReplay: true };

    const previous = await this.prisma.membership.findUnique({
      where: { id },
      include: { package: true },
    });
    if (!previous) throw new NotFoundException("Membership not found");
    if (previous.status === "cancelled")
      throw new ConflictException(
        "Cancelled memberships cannot be renewed — create a new sale instead",
      );

    const pkg = dto.packageId
      ? await this.prisma.package.findUnique({ where: { id: dto.packageId } })
      : previous.package;
    if (!pkg) throw new NotFoundException("Package not found");
    if (!pkg.isActive && pkg.id !== previous.packageId)
      throw new ConflictException(
        "Package is inactive — pick an active package or keep the current one",
      );

    const prevEnd = previous.endDate.toISOString().slice(0, 10);
    const start = renewalStartDate(prevEnd, dto.startDate ?? this.today());
    const pricing = this.price(pkg, dto.discountPct ?? 0);
    const end = this.endOf(start, pricing.durationDays);
    const invoiceNo = await this.nextInvoiceNo();

    const created = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: {
          memberId: previous.memberId,
          packageId: pkg.id,
          startDate: new Date(start + "T00:00:00Z"),
          endDate: new Date(end + "T00:00:00Z"),
          status: "active",
          price: pricing.price,
          registrationFee: pricing.registrationFee,
          discountPct: pricing.discountPct,
          discountAmount: pricing.discountAmount,
          gstPercent: pricing.gstPercent,
          gstAmount: pricing.gstAmount,
          total: pricing.total,
          notes: dto.notes?.trim() || null,
          renewedFromId: previous.id,
          idempotencyKey: dto.idempotencyKey,
          createdById: actorId,
          invoice: {
            create: {
              invoiceNo,
              memberId: previous.memberId,
              subtotal: pricing.price + pricing.registrationFee,
              discount: pricing.discountAmount,
              taxable: pricing.taxable,
              gst: pricing.gstAmount,
              total: pricing.total,
              status: "unpaid",
              createdById: actorId,
              items: {
                create: [
                  {
                    label: `${pkg.name} (${pkg.durationValue} ${pkg.durationUnit}) — renewal`,
                    qty: 1,
                    unitPrice: pricing.price,
                    amount: pricing.price,
                  },
                  ...(pricing.registrationFee > 0
                    ? [
                        {
                          label: "Registration fee",
                          qty: 1,
                          unitPrice: pricing.registrationFee,
                          amount: pricing.registrationFee,
                        },
                      ]
                    : []),
                ],
              },
            },
          },
          statusHistory: { create: { from: "none", to: "active", actorId, reason: "renewal" } },
        },
        include: { invoice: { include: { items: true } }, member: true, package: true },
      });
      await tx.renewalEvent.create({
        data: {
          membershipId: membership.id,
          previousId: previous.id,
          actorId,
          note: dto.notes?.trim() || null,
        },
      });
      return membership;
    });
    await this.audit.log("memberships.renew", "membership", created.id, actorId);
    return created;
  }

  async extend(id: string, dto: ExtendDto, actorId: string) {
    const m = await this.prisma.membership.findUnique({ where: { id } });
    if (!m) throw new NotFoundException("Membership not found");
    if (m.status === "cancelled")
      throw new ConflictException("Cancelled memberships cannot be extended");
    const today = this.today();
    const end = m.endDate.toISOString().slice(0, 10);
    if (m.status === "active" && end < today)
      throw new ConflictException("Membership already expired — renew instead of extending");
    const newEnd = addDays(end, dto.days);
    const updated = await this.prisma.membership.update({
      where: { id },
      data: { endDate: new Date(newEnd + "T00:00:00Z") },
      include: { member: true, package: true, invoice: { include: { items: true } } },
    });
    await this.prisma.membershipStatusHistory.create({
      data: {
        membershipId: id,
        from: m.status,
        to: m.status,
        actorId,
        reason: `extended +${dto.days}d${dto.reason ? `: ${dto.reason}` : ""}`,
      },
    });
    await this.audit.log("memberships.extend", "membership", id, actorId);
    return updated;
  }

  async suspend(id: string, dto: SuspendDto, actorId: string) {
    const m = await this.prisma.membership.findUnique({ where: { id } });
    if (!m) throw new NotFoundException("Membership not found");
    if (m.status !== "active")
      throw new ConflictException("Only active memberships can be suspended");
    const updated = await this.prisma.membership.update({
      where: { id },
      data: { status: "suspended", suspendedAt: new Date() },
      include: { member: true, package: true, invoice: { include: { items: true } } },
    });
    await this.prisma.membershipStatusHistory.create({
      data: {
        membershipId: id,
        from: "active",
        to: "suspended",
        actorId,
        reason: dto.reason?.trim() || null,
      },
    });
    await this.audit.log("memberships.suspend", "membership", id, actorId);
    return updated;
  }

  async resume(id: string, actorId: string) {
    const m = await this.prisma.membership.findUnique({ where: { id } });
    if (!m) throw new NotFoundException("Membership not found");
    if (m.status !== "suspended")
      throw new ConflictException("Only suspended memberships can be resumed");
    // Paused time is given back: end shifts by whole days spent suspended.
    const suspendedFrom = (m.suspendedAt ?? m.updatedAt).toISOString().slice(0, 10);
    const pausedDays = Math.max(0, diffDays(suspendedFrom, this.today()));
    const end = m.endDate.toISOString().slice(0, 10);
    const newEnd = addDays(end, pausedDays);
    const updated = await this.prisma.membership.update({
      where: { id },
      data: {
        status: "active",
        suspendedAt: null,
        suspensionDays: m.suspensionDays + pausedDays,
        endDate: new Date(newEnd + "T00:00:00Z"),
      },
      include: { member: true, package: true, invoice: { include: { items: true } } },
    });
    await this.prisma.membershipStatusHistory.create({
      data: {
        membershipId: id,
        from: "suspended",
        to: "active",
        actorId,
        reason: `resumed, +${pausedDays}d`,
      },
    });
    await this.audit.log("memberships.resume", "membership", id, actorId);
    return updated;
  }

  async cancel(id: string, dto: CancelDto, actorId: string) {
    const m = await this.prisma.membership.findUnique({ where: { id } });
    if (!m) throw new NotFoundException("Membership not found");
    if (m.status === "cancelled") throw new ConflictException("Membership is already cancelled");
    const updated = await this.prisma.membership.update({
      where: { id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: dto.reason.trim() },
      include: { member: true, package: true, invoice: { include: { items: true } } },
    });
    await this.prisma.membershipStatusHistory.create({
      data: {
        membershipId: id,
        from: m.status,
        to: "cancelled",
        actorId,
        reason: dto.reason.trim(),
      },
    });
    await this.audit.log("memberships.cancel", "membership", id, actorId);
    return updated;
  }

  async get(id: string) {
    const m = await this.prisma.membership.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, memberCode: true, fullName: true, mobile: true } },
        package: true,
        invoice: { include: { items: true } },
        renewedFrom: { select: { id: true, startDate: true, endDate: true } },
        renewedBy: { select: { id: true, startDate: true, endDate: true } },
        statusHistory: { orderBy: { createdAt: "desc" } },
        renewals: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!m) throw new NotFoundException("Membership not found");
    return { ...m, validity: this.validityOf(m) };
  }

  private validityOf(m: { startDate: Date; endDate: Date; status: string }) {
    return membershipValidity(
      m.startDate.toISOString().slice(0, 10),
      m.endDate.toISOString().slice(0, 10),
      this.today(),
      m.status as "active" | "suspended" | "cancelled",
    );
  }

  async list(query: MembershipListQuery) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20) || 20));
    const sort = SORTABLE.has(query.sort ?? "") ? query.sort! : "createdAt";
    const order = query.order === "asc" ? "asc" : "desc";
    const today = this.today();
    const where: Record<string, unknown> = {};
    if (query.memberId) where.memberId = query.memberId;
    if (query.packageId) where.packageId = query.packageId;
    if (query.status) where.status = query.status;
    if (query.expiringBefore) {
      where.status = "active";
      where.endDate = { lte: new Date(query.expiringBefore + "T23:59:59Z") };
    }
    if (query.validity) {
      // Stored status + date windows implement the single validity definition in SQL.
      if (query.validity === "active") {
        where.status = "active";
        where.startDate = { lte: new Date(today + "T23:59:59Z") };
        where.endDate = { gte: new Date(today + "T00:00:00Z") };
      } else if (query.validity === "expired") {
        where.status = "active";
        where.endDate = { lt: new Date(today + "T00:00:00Z") };
      } else if (query.validity === "scheduled") {
        where.status = "active";
        where.startDate = { gt: new Date(today + "T23:59:59Z") };
      } else {
        where.status = query.validity;
      }
    }
    if (query.q) {
      const q = query.q.trim();
      where.member = {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { memberCode: { contains: q, mode: "insensitive" } },
          { mobile: { contains: q } },
        ],
      };
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.membership.count({ where: where as never }),
      this.prisma.membership.findMany({
        where: where as never,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          member: { select: { id: true, memberCode: true, fullName: true, mobile: true } },
          package: { select: { id: true, name: true } },
        },
      }),
    ]);
    return {
      data: data.map((m) => ({ ...m, validity: this.validityOf(m) })),
      meta: { page, limit, total },
    };
  }

  /** Current (latest-starting) membership + validity for a member — attendance & UI reuse. */
  async currentByMember(memberId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException("Member not found");
    const latest = await this.prisma.membership.findFirst({
      where: { memberId },
      orderBy: { startDate: "desc" },
      include: { package: { select: { id: true, name: true } } },
    });
    if (!latest) return { membership: null, validity: "none" as const };
    return { membership: latest, validity: this.validityOf(latest) };
  }
}
