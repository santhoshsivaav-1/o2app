import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  eventDedupeKey,
  membershipValidity,
  todayInTimezone,
  toDateStrInTimezone,
} from "@o2app/shared";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import { MembershipsService } from "../memberships/memberships.service.js";
import { IngestSummary, RawDeviceEvent, SimulatedAdapter } from "./adapter.js";
import { CorrectRecordDto, ManualCheckInDto } from "./dto.js";

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

function sameLengthEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly memberships: MembershipsService,
  ) {}

  private tz(): string {
    return process.env.GYM_TIMEZONE ?? "Asia/Kolkata";
  }

  // ---------- devices ----------

  listDevices() {
    return this.prisma.attendanceDevice.findMany({ orderBy: { deviceCode: "asc" } });
  }

  async getDevice(id: string) {
    const device = await this.prisma.attendanceDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException("Device not found");
    const { apiKeyHash: _omit, ...safe } = device;
    return safe;
  }

  async createDevice(dto: { deviceCode: string; name: string; model?: string }, actorId: string) {
    const code = dto.deviceCode.trim().toUpperCase();
    const existing = await this.prisma.attendanceDevice.findUnique({ where: { deviceCode: code } });
    if (existing) throw new ConflictException("Device code already registered");
    const device = await this.prisma.attendanceDevice.create({
      data: {
        deviceCode: code,
        name: dto.name.trim(),
        model: dto.model?.trim() || null,
        createdById: actorId,
      },
    });
    await this.audit.log("devices.create", "device", device.id, actorId);
    const { apiKeyHash: _omit, ...safe } = device;
    return safe;
  }

  async updateDevice(
    id: string,
    dto: { name?: string; model?: string; isActive?: boolean; duplicateWindowMin?: number },
    actorId: string,
  ) {
    await this.getDevice(id);
    const device = await this.prisma.attendanceDevice.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        model: dto.model !== undefined ? dto.model?.trim() || null : undefined,
        isActive: dto.isActive,
        duplicateWindowMin: dto.duplicateWindowMin,
      },
    });
    await this.audit.log("devices.update", "device", id, actorId);
    const { apiKeyHash: _omit, ...safe } = device;
    return safe;
  }

  /** Returns the raw key ONCE — only its hash is stored. */
  async rotateDeviceKey(id: string, actorId: string) {
    await this.getDevice(id);
    const apiKey = `o2dev_${randomBytes(24).toString("hex")}`;
    await this.prisma.attendanceDevice.update({
      where: { id },
      data: { apiKeyHash: hashKey(apiKey) },
    });
    await this.audit.log("devices.key_rotate", "device", id, actorId);
    return { apiKey };
  }

  async revokeDeviceKey(id: string, actorId: string) {
    await this.getDevice(id);
    await this.prisma.attendanceDevice.update({ where: { id }, data: { apiKeyHash: null } });
    await this.audit.log("devices.key_revoke", "device", id, actorId);
    return { ok: true };
  }

  async listSyncRuns(deviceId: string) {
    await this.getDevice(deviceId);
    return this.prisma.deviceSyncRun.findMany({
      where: { deviceId },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
  }

  async deviceHealth(id: string) {
    const device = await this.getDevice(id);
    const [lastRun, mappings, today, unmapped] = await this.prisma.$transaction([
      this.prisma.deviceSyncRun.findFirst({
        where: { deviceId: id },
        orderBy: { startedAt: "desc" },
      }),
      this.prisma.deviceUserMapping.count({ where: { deviceId: id, status: "active" } }),
      this.prisma.attendanceEvent.count({
        where: {
          deviceId: id,
          occurredAt: { gte: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z") },
        },
      }),
      this.prisma.attendanceEvent.count({ where: { deviceId: id, status: "unmapped" } }),
    ]);
    return {
      device,
      lastSyncRun: lastRun,
      activeMappings: mappings,
      eventsToday: today,
      unmappedPending: unmapped,
    };
  }

  // ---------- mappings ----------

  listMappings(deviceId: string) {
    return this.prisma.deviceUserMapping.findMany({
      where: { deviceId },
      orderBy: { deviceUserId: "asc" },
      include: { member: { select: { id: true, memberCode: true, fullName: true } } },
    });
  }

  async upsertMapping(deviceId: string, deviceUserId: string, memberId: string, actorId: string) {
    await this.getDevice(deviceId);
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException("Member not found");
    const mapping = await this.prisma.deviceUserMapping.upsert({
      where: { deviceId_deviceUserId: { deviceId, deviceUserId: deviceUserId.trim() } },
      create: {
        deviceId,
        deviceUserId: deviceUserId.trim(),
        memberId,
        status: "active",
        createdById: actorId,
      },
      update: { memberId, status: "active" },
    });
    await this.audit.log("devices.map", "device", deviceId, actorId);
    // Reprocess pending unmapped events for this device user.
    await this.reprocessUnmapped(deviceId, deviceUserId.trim(), memberId);
    return mapping;
  }

  async deleteMapping(deviceId: string, mappingId: string, actorId: string) {
    const mapping = await this.prisma.deviceUserMapping.findUnique({ where: { id: mappingId } });
    if (!mapping || mapping.deviceId !== deviceId) throw new NotFoundException("Mapping not found");
    await this.prisma.deviceUserMapping.delete({ where: { id: mappingId } });
    await this.audit.log("devices.unmap", "device", deviceId, actorId);
    return { ok: true };
  }

  // ---------- ingestion pipeline ----------

  async ingestWithKey(
    deviceCode: string,
    apiKey: string,
    events: RawDeviceEvent[],
    source: string,
  ): Promise<IngestSummary> {
    const device = await this.prisma.attendanceDevice.findUnique({
      where: { deviceCode: deviceCode.trim().toUpperCase() },
    });
    if (
      !device ||
      !device.isActive ||
      !device.apiKeyHash ||
      !sameLengthEqual(device.apiKeyHash, hashKey(apiKey))
    )
      throw new UnauthorizedException("Invalid device credentials");
    return this.ingestEvents(device.id, events, source);
  }

  async ingestEvents(
    deviceId: string,
    events: RawDeviceEvent[],
    source: string,
  ): Promise<IngestSummary> {
    const device = await this.prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException("Device not found");
    const summary: IngestSummary = {
      fetched: events.length,
      ingested: 0,
      duplicates: 0,
      unmapped: 0,
      errors: [],
    };
    const sorted = [...events].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
    for (let i = 0; i < sorted.length; i++) {
      try {
        const outcome = await this.ingestOne(device, sorted[i], source);
        if (outcome === "ingested") summary.ingested++;
        else if (outcome === "duplicate") summary.duplicates++;
        else summary.unmapped++;
      } catch (e) {
        summary.errors.push({ index: i, error: (e as Error).message });
      }
    }
    await this.prisma.deviceSyncRun.create({
      data: {
        deviceId,
        finishedAt: new Date(),
        fetched: summary.fetched,
        ingested: summary.ingested,
        duplicates: summary.duplicates,
        unmapped: summary.unmapped,
        error: summary.errors.length > 0 ? `${summary.errors.length} item errors` : null,
      },
    });
    await this.prisma.attendanceDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
    return summary;
  }

  private async ingestOne(
    device: { id: string; deviceCode: string },
    raw: RawDeviceEvent,
    source: string,
  ): Promise<"ingested" | "duplicate" | "unmapped"> {
    if (!raw.deviceUserId) throw new BadRequestException("deviceUserId is required");
    const occurredAt = new Date(raw.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException("Invalid occurredAt");
    const key = eventDedupeKey(
      device.deviceCode,
      raw.deviceUserId,
      occurredAt.toISOString(),
      raw.deviceEventId,
    );

    // Idempotent replay first.
    const replay = await this.prisma.attendanceEvent.findUnique({ where: { dedupeKey: key } });
    if (replay) return replay.status === "unmapped" ? "unmapped" : "duplicate";

    const mapping = await this.prisma.deviceUserMapping.findUnique({
      where: { deviceId_deviceUserId: { deviceId: device.id, deviceUserId: raw.deviceUserId } },
    });
    if (!mapping || mapping.status !== "active" || !mapping.memberId) {
      await this.prisma.attendanceEvent.create({
        data: {
          deviceId: device.id,
          dedupeKey: key,
          deviceUserId: raw.deviceUserId,
          deviceEventId: raw.deviceEventId,
          occurredAt,
          source,
          status: "unmapped",
        },
      });
      return "unmapped";
    }

    const dateStr = toDateStrInTimezone(occurredAt, this.tz());
    try {
      const record = await this.prisma.attendanceRecord.create({
        data: {
          memberId: mapping.memberId,
          date: new Date(dateStr + "T00:00:00Z"),
          checkInAt: occurredAt,
          source,
        },
      });
      await this.prisma.attendanceEvent.create({
        data: {
          deviceId: device.id,
          dedupeKey: key,
          deviceUserId: raw.deviceUserId,
          deviceEventId: raw.deviceEventId,
          occurredAt,
          source,
          status: "mapped",
          memberId: mapping.memberId,
          recordId: record.id,
        },
      });
      return "ingested";
    } catch (e) {
      // Lost a same-key or same-day race: the raw scan is still preserved.
      if (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        const replay = await this.prisma.attendanceEvent.findUnique({ where: { dedupeKey: key } });
        if (replay) return replay.status === "unmapped" ? "unmapped" : "duplicate";
        const winner = await this.prisma.attendanceRecord.findUnique({
          where: {
            memberId_date: { memberId: mapping.memberId, date: new Date(dateStr + "T00:00:00Z") },
          },
        });
        if (winner) {
          await this.prisma.attendanceEvent
            .create({
              data: {
                deviceId: device.id,
                dedupeKey: `${key}#${Date.now()}`,
                deviceUserId: raw.deviceUserId,
                deviceEventId: raw.deviceEventId,
                occurredAt,
                source,
                status: "duplicate",
                memberId: mapping.memberId,
                recordId: winner.id,
              },
            })
            .catch(() => undefined);
          return "duplicate";
        }
      }
      throw e;
    }
  }

  private async reprocessUnmapped(deviceId: string, deviceUserId: string, memberId: string) {
    const pending = await this.prisma.attendanceEvent.findMany({
      where: { deviceId, deviceUserId, status: "unmapped" },
      orderBy: { occurredAt: "asc" },
    });
    for (const event of pending) {
      const dateStr = toDateStrInTimezone(event.occurredAt, this.tz());
      const existing = await this.prisma.attendanceRecord.findUnique({
        where: { memberId_date: { memberId, date: new Date(dateStr + "T00:00:00Z") } },
      });
      if (existing) {
        await this.prisma.attendanceEvent.update({
          where: { id: event.id },
          data: { status: "duplicate", memberId, recordId: existing.id },
        });
      } else {
        const record = await this.prisma.attendanceRecord.create({
          data: {
            memberId,
            date: new Date(dateStr + "T00:00:00Z"),
            checkInAt: event.occurredAt,
            source: event.source,
          },
        });
        await this.prisma.attendanceEvent.update({
          where: { id: event.id },
          data: { status: "mapped", memberId, recordId: record.id },
        });
      }
    }
  }

  // ---------- manual + corrections ----------

  async manualCheckIn(dto: ManualCheckInDto, actorId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: dto.memberId } });
    if (!member) throw new NotFoundException("Member not found");
    if (member.status === "archived") throw new ConflictException("Member is archived");
    const date = dto.date ?? toDateStrInTimezone(new Date(), this.tz());
    const time = dto.time ?? new Date().toISOString().slice(11, 16);
    const occurredAt = new Date(`${date}T${time}:00Z`);
    if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException("Invalid date/time");
    const key = `manual:${member.id}:${date}:${time}`;
    const replay = await this.prisma.attendanceEvent.findUnique({
      where: { dedupeKey: key },
      include: { record: true },
    });
    if (replay?.record) return { ...replay.record, idempotentReplay: true };

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { memberId_date: { memberId: member.id, date: new Date(date + "T00:00:00Z") } },
    });
    if (existing) return { ...existing, idempotentReplay: true };

    const record = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.attendanceRecord.create({
        data: {
          memberId: member.id,
          date: new Date(date + "T00:00:00Z"),
          checkInAt: occurredAt,
          source: "manual",
          createdById: actorId,
        },
      });
      await tx.attendanceEvent.create({
        data: {
          dedupeKey: key,
          deviceUserId: "manual",
          occurredAt,
          source: "manual",
          status: "mapped",
          memberId: member.id,
          recordId: rec.id,
        },
      });
      return rec;
    });
    await this.audit.log("attendance.manual", "attendance", record.id, actorId);
    return record;
  }

  async correctRecord(id: string, dto: CorrectRecordDto, actorId: string) {
    const record = await this.prisma.attendanceRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Attendance record not found");
    const before = {
      date: record.date.toISOString().slice(0, 10),
      checkInAt: record.checkInAt.toISOString(),
    };
    const date = dto.date ?? before.date;
    let checkInAt = record.checkInAt;
    if (dto.checkInTime) {
      checkInAt = new Date(`${date}T${dto.checkInTime}:00Z`);
      if (Number.isNaN(checkInAt.getTime())) throw new BadRequestException("Invalid check-in time");
    } else if (dto.date) {
      const time = record.checkInAt.toISOString().slice(11, 16);
      checkInAt = new Date(`${date}T${time}:00Z`);
    }
    if (date !== before.date) {
      const clash = await this.prisma.attendanceRecord.findUnique({
        where: {
          memberId_date: { memberId: record.memberId, date: new Date(date + "T00:00:00Z") },
        },
      });
      if (clash && clash.id !== id)
        throw new ConflictException("Member already has a check-in on that date");
    }
    const after = { date, checkInAt: checkInAt.toISOString() };
    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.attendanceRecord.update({
        where: { id },
        data: { date: new Date(date + "T00:00:00Z"), checkInAt },
      });
      await tx.attendanceCorrection.create({
        data: {
          recordId: id,
          before: JSON.stringify(before),
          after: JSON.stringify(after),
          actorId,
          reason: dto.reason.trim(),
        },
      });
      return rec;
    });
    await this.audit.log("attendance.correct", "attendance", id, actorId);
    return updated;
  }

  async recordCorrections(id: string) {
    const record = await this.prisma.attendanceRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Attendance record not found");
    return this.prisma.attendanceCorrection.findMany({
      where: { recordId: id },
      orderBy: { createdAt: "desc" },
    });
  }

  // ---------- unmapped review ----------

  async unmappedEvents(page = 1, limit = 20) {
    const [total, data] = await this.prisma.$transaction([
      this.prisma.attendanceEvent.count({ where: { status: "unmapped" } }),
      this.prisma.attendanceEvent.findMany({
        where: { status: "unmapped" },
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { device: { select: { id: true, deviceCode: true, name: true } } },
      }),
    ]);
    return { data, meta: { page, limit, total } };
  }

  async mapUnmappedEvent(eventId: string, memberId: string, actorId: string) {
    const event = await this.prisma.attendanceEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Event not found");
    if (event.status !== "unmapped") throw new ConflictException("Event is already processed");
    if (!event.deviceId) throw new BadRequestException("Manual events need no mapping");
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException("Member not found");
    await this.upsertMapping(event.deviceId, event.deviceUserId, memberId, actorId);
    return this.prisma.attendanceEvent.findUnique({
      where: { id: eventId },
      include: { record: true, member: { select: { id: true, memberCode: true, fullName: true } } },
    });
  }

  // ---------- queries ----------

  async listRecords(query: {
    date?: string;
    memberId?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    includeValidity?: string;
  }) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20) || 20));
    const where: Record<string, unknown> = {};
    if (query.memberId) where.memberId = query.memberId;
    if (query.date) {
      where.date = new Date(query.date + "T00:00:00Z");
    } else if (query.from || query.to) {
      where.date = {
        gte: query.from ? new Date(query.from + "T00:00:00Z") : undefined,
        lte: query.to ? new Date(query.to + "T00:00:00Z") : undefined,
      };
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
      this.prisma.attendanceRecord.count({ where: where as never }),
      this.prisma.attendanceRecord.findMany({
        where: where as never,
        orderBy: [{ date: "desc" }, { checkInAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          member: { select: { id: true, memberCode: true, fullName: true, mobile: true } },
        },
      }),
    ]);
    if (query.includeValidity !== "true") return { data, meta: { page, limit, total } };
    // One extra query for the whole page: latest membership per member.
    const memberIds = [...new Set(data.map((r) => r.memberId))];
    const memberships = await this.prisma.membership.findMany({
      where: { memberId: { in: memberIds } },
      orderBy: { startDate: "desc" },
      select: { memberId: true, startDate: true, endDate: true, status: true },
    });
    const latest = new Map<string, (typeof memberships)[number]>();
    for (const m of memberships) {
      if (!latest.has(m.memberId)) latest.set(m.memberId, m);
    }
    const today = todayInTimezone(this.tz());
    return {
      data: data.map((r) => {
        const m = latest.get(r.memberId);
        return {
          ...r,
          validity: m
            ? membershipValidity(
                m.startDate.toISOString().slice(0, 10),
                m.endDate.toISOString().slice(0, 10),
                today,
                m.status as "active" | "suspended" | "cancelled",
              )
            : "none",
        };
      }),
      meta: { page, limit, total },
    };
  }

  async memberHistory(memberId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException("Member not found");
    const records = await this.prisma.attendanceRecord.findMany({
      where: { memberId },
      orderBy: { date: "desc" },
      take: 200,
    });
    let validity: { membership: unknown; validity: string };
    try {
      validity = await this.memberships.currentByMember(memberId);
    } catch {
      validity = { membership: null, validity: "none" };
    }
    return { records, validity: validity.validity };
  }

  private esc(v: unknown): string {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
  }

  async exportCsv(query: { from?: string; to?: string; memberId?: string }) {
    const { data } = await this.listRecords({ ...query, page: "1", limit: "5000" });
    const rows = (data as Record<string, unknown>[]).map((r) =>
      [
        (r.date as Date).toISOString().slice(0, 10),
        (r.member as Record<string, unknown>).memberCode,
        (r.member as Record<string, unknown>).fullName,
        (r.checkInAt as Date).toISOString(),
        r.source,
      ]
        .map((v) => this.esc(v))
        .join(","),
    );
    return ["date,member_code,member_name,check_in_at,source", ...rows].join("\n");
  }

  // ---------- simulator (dev/test only, never production data) ----------

  async simulate(deviceId: string, count: number, memberIds: string[], actorId: string) {
    if ((process.env.NODE_ENV ?? "development") === "production")
      throw new BadRequestException("Simulation is disabled in production");
    const device = await this.getDevice(deviceId);
    const adapter = new SimulatedAdapter();
    await adapter.connect();
    const deviceUsers: string[] = [];
    for (const memberId of memberIds) {
      const member = await this.prisma.member.findUnique({ where: { id: memberId } });
      if (!member) throw new NotFoundException("Member not found");
      const deviceUserId = `sim-${memberId.slice(0, 8)}`;
      await this.upsertMapping(deviceId, deviceUserId, memberId, actorId);
      deviceUsers.push(deviceUserId);
    }
    const sim = new SimulatedAdapter(deviceUsers.length > 0 ? deviceUsers : undefined, count);
    await sim.connect();
    const { events } = await sim.fetchAttendanceEvents();
    const summary = await this.ingestEvents(deviceId, events, "simulated");
    await this.audit.log("devices.simulate", "device", device.id, actorId);
    return summary;
  }
}
