import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { normalizeMobile } from "@o2app/shared";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import { SequenceService } from "./sequences.js";
import { CreateMemberDto, UpdateMemberDto } from "./dto.js";

export interface MemberListQuery {
  q?: string;
  status?: string;
  genderId?: string;
  registeredFrom?: string;
  registeredTo?: string;
  sort?: string;
  order?: string;
  page?: string;
  limit?: string;
}

const SORTABLE = new Set(["fullName", "memberCode", "registrationDate", "createdAt"]);

function emptyToNull(v: unknown): unknown {
  return v === "" ? null : v;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sequences: SequenceService,
  ) {}

  private async assertGender(genderId: string) {
    const gender = await this.prisma.genderCategory.findUnique({ where: { id: genderId } });
    if (!gender) throw new BadRequestException("Unknown gender category");
    if (!gender.isActive) throw new BadRequestException("Gender category is inactive");
    return gender;
  }

  private async assertTrainer(trainerId: string) {
    const trainer = await this.prisma.user.findUnique({ where: { id: trainerId } });
    if (!trainer || !trainer.isActive) throw new BadRequestException("Assigned trainer not found");
  }

  private assertMobile(mobile: string): string {
    const norm = normalizeMobile(mobile);
    if (norm.length < 10) throw new BadRequestException("Invalid mobile number");
    return norm;
  }

  private async duplicates(mobileNorm: string, excludeId?: string) {
    return this.prisma.member.findMany({
      where: { mobileNorm, id: excludeId ? { not: excludeId } : undefined },
      select: { id: true, memberCode: true, fullName: true, mobile: true, status: true },
      take: 5,
    });
  }

  private toDateOnly(s: string | undefined, field: string): Date | undefined {
    if (s === undefined) return undefined;
    const d = new Date(s + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid ${field}`);
    return d;
  }

  async create(dto: CreateMemberDto, actorId: string) {
    await this.assertGender(dto.genderId);
    if (dto.assignedTrainerId) await this.assertTrainer(dto.assignedTrainerId);
    const mobileNorm = this.assertMobile(dto.mobile);
    const dob = this.toDateOnly(dto.dob, "dob");
    if (dob && dob > new Date()) throw new BadRequestException("DOB cannot be in the future");
    const dupes = await this.duplicates(mobileNorm);
    if (dupes.length > 0 && !dto.confirmDuplicate)
      throw new ConflictException({
        message: "Possible duplicate member — same mobile number already registered",
        matches: dupes,
      });
    const regDate = this.toDateOnly(dto.registrationDate, "registrationDate") ?? new Date();
    const year = regDate.getUTCFullYear();
    const memberCode = await this.sequences.nextMemberCode(year);
    const member = await this.prisma.member.create({
      data: {
        memberCode,
        fullName: dto.fullName.trim(),
        mobile: dto.mobile.trim(),
        mobileNorm,
        email: (emptyToNull(dto.email?.trim()) as string | null) ?? undefined,
        genderId: dto.genderId,
        dob: dob ?? undefined,
        address: (emptyToNull(dto.address?.trim()) as string | null) ?? undefined,
        emergencyContact: (emptyToNull(dto.emergencyContact?.trim()) as string | null) ?? undefined,
        registrationDate: regDate,
        photoUrl: (emptyToNull(dto.photoUrl?.trim()) as string | null) ?? undefined,
        notes: (emptyToNull(dto.notes?.trim()) as string | null) ?? undefined,
        status: dto.status ?? "active",
        source: (emptyToNull(dto.source?.trim()) as string | null) ?? undefined,
        assignedTrainerId: dto.assignedTrainerId,
        deviceUserId: (emptyToNull(dto.deviceUserId?.trim()) as string | null) ?? undefined,
        createdById: actorId,
      },
      include: { gender: true },
    });
    await this.audit.log("members.create", "member", member.id, actorId);
    return member;
  }

  async update(id: string, dto: UpdateMemberDto, actorId: string) {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Member not found");
    if (dto.genderId) await this.assertGender(dto.genderId);
    if (dto.assignedTrainerId) await this.assertTrainer(dto.assignedTrainerId);
    let mobileNorm: string | undefined;
    if (dto.mobile !== undefined) {
      mobileNorm = this.assertMobile(dto.mobile);
      const dupes = await this.duplicates(mobileNorm, id);
      if (dupes.length > 0 && !dto.confirmDuplicate)
        throw new ConflictException({
          message: "Possible duplicate member — same mobile number already registered",
          matches: dupes,
        });
    }
    if (dto.dob !== undefined) {
      const dob = this.toDateOnly(dto.dob, "dob");
      if (dob && dob > new Date()) throw new BadRequestException("DOB cannot be in the future");
    }
    if (dto.deviceUserId !== undefined && dto.deviceUserId !== "") {
      const clash = await this.prisma.member.findUnique({
        where: { deviceUserId: dto.deviceUserId.trim() },
      });
      if (clash && clash.id !== id)
        throw new ConflictException("Device user ID already mapped to another member");
    }
    const member = await this.prisma.member.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        mobile: dto.mobile?.trim(),
        mobileNorm,
        email:
          dto.email !== undefined
            ? ((emptyToNull(dto.email.trim()) as string | null) ?? null)
            : undefined,
        genderId: dto.genderId,
        dob: dto.dob !== undefined ? (this.toDateOnly(dto.dob, "dob") ?? null) : undefined,
        address:
          dto.address !== undefined
            ? ((emptyToNull(dto.address.trim()) as string | null) ?? null)
            : undefined,
        emergencyContact:
          dto.emergencyContact !== undefined
            ? ((emptyToNull(dto.emergencyContact.trim()) as string | null) ?? null)
            : undefined,
        registrationDate:
          dto.registrationDate !== undefined
            ? this.toDateOnly(dto.registrationDate, "registrationDate")
            : undefined,
        photoUrl:
          dto.photoUrl !== undefined
            ? ((emptyToNull(dto.photoUrl.trim()) as string | null) ?? null)
            : undefined,
        notes:
          dto.notes !== undefined
            ? ((emptyToNull(dto.notes.trim()) as string | null) ?? null)
            : undefined,
        source:
          dto.source !== undefined
            ? ((emptyToNull(dto.source.trim()) as string | null) ?? null)
            : undefined,
        assignedTrainerId: dto.assignedTrainerId,
        deviceUserId:
          dto.deviceUserId !== undefined
            ? ((emptyToNull(dto.deviceUserId.trim()) as string | null) ?? null)
            : undefined,
        updatedById: actorId,
      },
      include: { gender: true },
    });
    await this.audit.log("members.update", "member", id, actorId);
    return member;
  }

  async get(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        gender: true,
        assignedTrainer: { select: { id: true, name: true } },
        memberNotes: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  async list(query: MemberListQuery) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20) || 20));
    const sort = SORTABLE.has(query.sort ?? "") ? query.sort! : "createdAt";
    const order = query.order === "asc" ? "asc" : "desc";
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.genderId) where.genderId = query.genderId;
    if (query.registeredFrom || query.registeredTo) {
      where.registrationDate = {
        gte: query.registeredFrom ? new Date(query.registeredFrom + "T00:00:00Z") : undefined,
        lte: query.registeredTo ? new Date(query.registeredTo + "T23:59:59Z") : undefined,
      };
    }
    if (query.q) {
      const q = query.q.trim();
      const digits = q.replace(/\D/g, "");
      const ors: Record<string, unknown>[] = [
        { fullName: { contains: q, mode: "insensitive" } },
        { memberCode: { contains: q, mode: "insensitive" } },
      ];
      if (digits.length >= 4) {
        ors.push({ mobileNorm: { contains: digits } });
        ors.push({ mobile: { contains: q } });
      } else {
        ors.push({ mobile: { contains: q } });
      }
      where.OR = ors;
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.member.count({ where: where as never }),
      this.prisma.member.findMany({
        where: where as never,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
        include: { gender: true },
      }),
    ]);
    return { data, meta: { page, limit, total } };
  }

  async archive(id: string, actorId: string) {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Member not found");
    const member = await this.prisma.member.update({
      where: { id },
      data: { status: "archived", archivedAt: new Date(), archivedById: actorId },
    });
    await this.audit.log("members.archive", "member", id, actorId);
    return member;
  }

  async restore(id: string, actorId: string) {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Member not found");
    const member = await this.prisma.member.update({
      where: { id },
      data: { status: "active", archivedAt: null, archivedById: null, updatedById: actorId },
    });
    await this.audit.log("members.restore", "member", id, actorId);
    return member;
  }

  async addNote(id: string, body: string, actorId: string) {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Member not found");
    const note = await this.prisma.memberNote.create({
      data: { memberId: id, body: body.trim(), createdById: actorId },
    });
    await this.audit.log("members.note", "member", id, actorId);
    return note;
  }

  async exportCsv(query: MemberListQuery): Promise<string> {
    const { data } = await this.list({ ...query, page: "1", limit: "5000" });
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = data.map((m: Record<string, unknown>) =>
      [
        m.memberCode,
        m.fullName,
        m.mobile,
        m.email,
        (m.gender as Record<string, unknown> | null)?.name ?? "",
        m.status,
        m.registrationDate,
        m.source ?? "",
      ]
        .map(esc)
        .join(","),
    );
    return [
      "member_code,full_name,mobile,email,gender,status,registration_date,source",
      ...rows,
    ].join("\n");
  }
}
