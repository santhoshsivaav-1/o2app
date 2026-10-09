import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { formatEnquiryNo, isEnquiryTerminal, normalizeMobile } from "@o2app/shared";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import { MembersService } from "../members/members.service.js";
import {
  CompleteFollowUpDto,
  ConvertEnquiryDto,
  CreateEnquiryDto,
  CreateFollowUpDto,
  EnquiryListQuery,
  EnquiryReportQuery,
  FollowUpQueueQuery,
  UpdateEnquiryDto,
} from "./dto.js";

@Injectable()
export class EnquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly members: MembersService,
  ) {}

  private async nextEnquiryNo(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const counter = await this.prisma.seqCounter.upsert({
      where: { name_year: { name: "enquiry", year } },
      create: { name: "enquiry", year, last: 1 },
      update: { last: { increment: 1 } },
    });
    return formatEnquiryNo(year, counter.last);
  }

  private parseDateTime(s: string | undefined | null, field: string): Date | null | undefined {
    if (s === undefined) return undefined;
    if (s === null) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid ${field}`);
    return d;
  }

  private async assertAssignee(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive) throw new BadRequestException("Assigned staff member not found");
  }

  // ---------- enquiries ----------

  async create(dto: CreateEnquiryDto, actorId: string) {
    if (dto.assignedToId) await this.assertAssignee(dto.assignedToId);
    if (dto.interestPackageId) {
      const pkg = await this.prisma.package.findUnique({ where: { id: dto.interestPackageId } });
      if (!pkg) throw new BadRequestException("Interest package not found");
    }
    const enquiry = await this.prisma.enquiry.create({
      data: {
        enquiryNo: await this.nextEnquiryNo(),
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        phoneNorm: normalizeMobile(dto.phone),
        email: dto.email?.trim() || null,
        interest: dto.interest?.trim() || null,
        interestPackageId: dto.interestPackageId,
        source: dto.source?.trim() || null,
        enquiryDate: dto.enquiryDate ? new Date(dto.enquiryDate + "T00:00:00Z") : new Date(),
        assignedToId: dto.assignedToId,
        status: dto.status ?? "new",
        nextFollowUpAt: this.parseDateTime(dto.nextFollowUpAt, "nextFollowUpAt") ?? null,
        notes: dto.notes?.trim() || null,
        createdById: actorId,
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    await this.audit.log("enquiries.create", "enquiry", enquiry.id, actorId);
    return enquiry;
  }

  async update(id: string, dto: UpdateEnquiryDto, actorId: string) {
    const existing = await this.prisma.enquiry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Enquiry not found");
    if (existing.status === "converted") {
      const keys = Object.keys(dto).filter(
        (k) => (dto as Record<string, unknown>)[k] !== undefined,
      );
      const onlyNotes = keys.length > 0 && keys.every((k) => k === "notes");
      if (!onlyNotes)
        throw new ConflictException("Converted enquiries are history — only notes can be edited");
    }
    if (dto.assignedToId) await this.assertAssignee(dto.assignedToId);
    if (dto.interestPackageId) {
      const pkg = await this.prisma.package.findUnique({ where: { id: dto.interestPackageId } });
      if (!pkg) throw new BadRequestException("Interest package not found");
    }
    const status = dto.status ?? existing.status;
    const enquiry = await this.prisma.enquiry.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        phoneNorm: dto.phone ? normalizeMobile(dto.phone) : undefined,
        email: dto.email !== undefined ? dto.email?.trim() || null : undefined,
        interest: dto.interest !== undefined ? dto.interest?.trim() || null : undefined,
        interestPackageId: dto.interestPackageId,
        source: dto.source !== undefined ? dto.source?.trim() || null : undefined,
        enquiryDate: dto.enquiryDate ? new Date(dto.enquiryDate + "T00:00:00Z") : undefined,
        assignedToId: dto.assignedToId !== undefined ? dto.assignedToId : undefined,
        status,
        // Closing the loop clears the next action; reopening needs an explicit new date.
        nextFollowUpAt:
          dto.nextFollowUpAt !== undefined
            ? this.parseDateTime(dto.nextFollowUpAt, "nextFollowUpAt")
            : status === "lost"
              ? null
              : undefined,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    await this.audit.log("enquiries.update", "enquiry", id, actorId);
    return enquiry;
  }

  async get(id: string) {
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true } },
        interestPackage: { select: { id: true, name: true } },
        convertedMember: { select: { id: true, memberCode: true, fullName: true } },
        followUps: { orderBy: [{ doneAt: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }] },
      },
    });
    if (!enquiry) throw new NotFoundException("Enquiry not found");
    return enquiry;
  }

  async list(
    query: EnquiryListQuery & { page?: string; limit?: string; sort?: string; order?: string },
  ) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20) || 20));
    const order = query.order === "asc" ? "asc" : "desc";
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.source) where.source = query.source;
    if (query.from || query.to) {
      where.enquiryDate = {
        gte: query.from ? new Date(query.from + "T00:00:00Z") : undefined,
        lte: query.to ? new Date(query.to + "T23:59:59Z") : undefined,
      };
    }
    if (query.overdue === "true") {
      where.status = { notIn: ["converted", "lost"] };
      where.nextFollowUpAt = { lt: new Date() };
    }
    if (query.q) {
      const q = query.q.trim();
      const digits = q.replace(/\D/g, "");
      const ors: Record<string, unknown>[] = [
        { name: { contains: q, mode: "insensitive" } },
        { enquiryNo: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
      if (digits.length >= 4) ors.push({ phoneNorm: { contains: digits } });
      where.OR = ors;
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.enquiry.count({ where: where as never }),
      this.prisma.enquiry.findMany({
        where: where as never,
        orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: order }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { followUps: true } },
        },
      }),
    ]);
    const now = new Date();
    return {
      data: data.map((e) => ({
        ...e,
        overdue:
          !isEnquiryTerminal(e.status) && e.nextFollowUpAt !== null && e.nextFollowUpAt < now,
      })),
      meta: { page, limit, total },
    };
  }

  async sources() {
    const rows = await this.prisma.enquiry.groupBy({
      by: ["source"],
      _count: { source: true },
      orderBy: { _count: { source: "desc" } },
    });
    return rows
      .filter((r) => r.source)
      .map((r) => ({ source: r.source as string, count: r._count.source }));
  }

  async assignees() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  // ---------- follow-ups ----------

  async addFollowUp(enquiryId: string, dto: CreateFollowUpDto, actorId: string) {
    const enquiry = await this.prisma.enquiry.findUnique({ where: { id: enquiryId } });
    if (!enquiry) throw new NotFoundException("Enquiry not found");
    if (enquiry.status === "converted")
      throw new ConflictException("Enquiry already converted — add notes to the member instead");
    const dueAt = this.parseDateTime(dto.dueAt, "dueAt") ?? null;
    const followUp = await this.prisma.followUp.create({
      data: {
        enquiryId,
        activity: dto.activity,
        note: dto.note?.trim() || null,
        dueAt,
        createdById: actorId,
      },
    });
    if (dueAt && (enquiry.nextFollowUpAt === null || dueAt < enquiry.nextFollowUpAt)) {
      await this.prisma.enquiry.update({
        where: { id: enquiryId },
        data: { nextFollowUpAt: dueAt },
      });
    }
    await this.audit.log("enquiries.followup", "enquiry", enquiryId, actorId);
    return followUp;
  }

  async completeFollowUp(id: string, dto: CompleteFollowUpDto, actorId: string) {
    const followUp = await this.prisma.followUp.findUnique({ where: { id } });
    if (!followUp) throw new NotFoundException("Follow-up not found");
    const updated = await this.prisma.followUp.update({
      where: { id },
      data: {
        doneAt: new Date(),
        note: dto.note?.trim()
          ? followUp.note
            ? `${followUp.note}\n${dto.note.trim()}`
            : dto.note.trim()
          : undefined,
      },
    });
    const next = await this.prisma.followUp.findFirst({
      where: { enquiryId: followUp.enquiryId, doneAt: null, dueAt: { not: null } },
      orderBy: { dueAt: "asc" },
    });
    await this.prisma.enquiry.update({
      where: { id: followUp.enquiryId },
      data: { nextFollowUpAt: next?.dueAt ?? null },
    });
    await this.audit.log("enquiries.followup_done", "enquiry", followUp.enquiryId, actorId);
    return updated;
  }

  async listFollowUps(enquiryId: string) {
    const enquiry = await this.prisma.enquiry.findUnique({ where: { id: enquiryId } });
    if (!enquiry) throw new NotFoundException("Enquiry not found");
    return this.prisma.followUp.findMany({
      where: { enquiryId },
      orderBy: [{ doneAt: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    });
  }

  async queue(query: FollowUpQueueQuery) {
    const scope = query.scope ?? "overdue";
    const days = Math.min(90, Math.max(1, Number(query.days ?? 7) || 7));
    const now = new Date();
    const where: Record<string, unknown> = {
      doneAt: null,
      enquiry: { status: { notIn: ["converted", "lost"] } },
    };
    if (query.assignedToId) {
      (where.enquiry as Record<string, unknown>).assignedToId = query.assignedToId;
    }
    if (scope === "overdue") where.dueAt = { lt: now };
    else if (scope === "upcoming")
      where.dueAt = { gte: now, lte: new Date(now.getTime() + days * 24 * 3600 * 1000) };
    const rows = await this.prisma.followUp.findMany({
      where: where as never,
      orderBy: { dueAt: "asc" },
      take: 200,
      include: {
        enquiry: {
          select: {
            id: true,
            enquiryNo: true,
            name: true,
            phone: true,
            status: true,
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
    });
    return {
      scope,
      data: rows.map((f) => ({
        ...f,
        overdue: f.dueAt !== null && f.dueAt < now,
      })),
    };
  }

  // ---------- conversion (explicit, audited, history-preserving) ----------

  async convert(id: string, dto: ConvertEnquiryDto, actorId: string) {
    const enquiry = await this.prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) throw new NotFoundException("Enquiry not found");
    if (enquiry.status === "converted" || enquiry.convertedMemberId)
      throw new ConflictException("Enquiry already converted");
    // Reuse member registration (including duplicate-mobile protection).
    // Sequential, not transactional: validation happens up-front inside create(),
    // and the enquiry update below is a single row write. Staff should check the
    // member directory before retrying a failed conversion.
    const member = await this.members.create(
      {
        fullName: enquiry.name,
        mobile: enquiry.phone,
        email: enquiry.email ?? undefined,
        genderId: dto.genderId,
        dob: dto.dob,
        address: dto.address,
        source: enquiry.source ? `enquiry:${enquiry.source}` : "enquiry",
        notes: dto.notes?.trim() || `Converted from ${enquiry.enquiryNo}`,
        confirmDuplicate: dto.confirmDuplicate,
      },
      actorId,
    );
    const updated = await this.prisma.enquiry.update({
      where: { id },
      data: {
        status: "converted",
        convertedMemberId: member.id,
        convertedAt: new Date(),
        nextFollowUpAt: null,
        followUps: {
          create: {
            activity: "note",
            note: `Converted to member ${member.memberCode}`,
            doneAt: new Date(),
            createdById: actorId,
          },
        },
      },
      include: {
        convertedMember: { select: { id: true, memberCode: true, fullName: true } },
      },
    });
    await this.audit.log("enquiries.convert", "enquiry", id, actorId);
    return updated;
  }

  // ---------- report ----------

  async report(query: { from: string; to: string }) {
    if (query.from > query.to) throw new BadRequestException("from must be on/before to");
    const from = new Date(query.from + "T00:00:00Z");
    const to = new Date(query.to + "T23:59:59Z");
    const inRange = await this.prisma.enquiry.findMany({
      where: { enquiryDate: { gte: from, lte: to } },
      select: { status: true, source: true },
    });
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const e of inRange) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
      if (e.source) bySource[e.source] = (bySource[e.source] ?? 0) + 1;
    }
    const converted = byStatus["converted"] ?? 0;
    const followUps = await this.prisma.followUp.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { doneAt: true, dueAt: true },
    });
    const now = new Date();
    const done = followUps.filter((f) => f.doneAt !== null).length;
    const overdue = followUps.filter(
      (f) => f.doneAt === null && f.dueAt !== null && f.dueAt < now,
    ).length;
    return {
      from: query.from,
      to: query.to,
      total: inRange.length,
      converted,
      conversionRate: inRange.length > 0 ? Math.round((converted / inRange.length) * 1000) / 10 : 0,
      byStatus,
      bySource,
      followUps: { total: followUps.length, done, overdue },
    };
  }
}
