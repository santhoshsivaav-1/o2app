import { Body, Controller, Delete, Get, Header, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AttendanceService } from "./attendance.service.js";
import {
  AttendanceListQuery,
  CorrectRecordDto,
  CreateDeviceDto,
  ManualCheckInDto,
  MapUnmappedDto,
  SimulateDto,
  UpdateDeviceDto,
  UpsertMappingDto,
} from "./dto.js";
import { RequestUser, RequirePermissions } from "../auth/guards.js";

const params = (req: Request) => req.params as Record<string, string>;

@ApiTags("attendance")
@Controller()
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  // ----- records -----

  @Get("attendance")
  @RequirePermissions("attendance.read")
  list(@Query() query: AttendanceListQuery & { page?: string; limit?: string }) {
    return this.attendance.listRecords(query);
  }

  @Get("attendance/daily")
  @RequirePermissions("attendance.read")
  daily(@Query() query: { date?: string; q?: string; includeValidity?: string }) {
    return this.attendance.listRecords({
      date: query.date,
      q: query.q,
      includeValidity: query.includeValidity,
      page: "1",
      limit: "500",
    });
  }

  @Get("attendance/by-member/:memberId")
  @RequirePermissions("attendance.read")
  byMember(@Req() req: Request) {
    return this.attendance.memberHistory(params(req).memberId);
  }

  @Post("attendance/manual")
  @RequirePermissions("attendance.correct")
  manual(@Req() req: Request, @Body() dto: ManualCheckInDto) {
    return this.attendance.manualCheckIn(dto, (req.user as RequestUser).id);
  }

  @Patch("attendance/records/:id")
  @RequirePermissions("attendance.correct")
  correct(@Req() req: Request, @Body() dto: CorrectRecordDto) {
    return this.attendance.correctRecord(params(req).id, dto, (req.user as RequestUser).id);
  }

  @Get("attendance/records/:id/corrections")
  @RequirePermissions("attendance.read")
  corrections(@Req() req: Request) {
    return this.attendance.recordCorrections(params(req).id);
  }

  // ----- unmapped review -----

  @Get("attendance/unmapped")
  @RequirePermissions("attendance.read")
  unmapped(@Query() query: { page?: string; limit?: string }) {
    return this.attendance.unmappedEvents(Number(query.page ?? 1) || 1, 20);
  }

  @Post("attendance/unmapped/:id/map")
  @RequirePermissions("attendance.correct")
  mapUnmapped(@Req() req: Request, @Body() dto: MapUnmappedDto) {
    return this.attendance.mapUnmappedEvent(
      params(req).id,
      dto.memberId,
      (req.user as RequestUser).id,
    );
  }

  // ----- devices -----

  @Get("devices")
  @RequirePermissions("attendance.read")
  devices() {
    return this.attendance.listDevices();
  }

  @Post("devices")
  @RequirePermissions("settings.manage")
  createDevice(@Req() req: Request, @Body() dto: CreateDeviceDto) {
    return this.attendance.createDevice(dto, (req.user as RequestUser).id);
  }

  @Get("devices/:id")
  @RequirePermissions("attendance.read")
  device(@Req() req: Request) {
    return this.attendance.getDevice(params(req).id);
  }

  @Patch("devices/:id")
  @RequirePermissions("settings.manage")
  updateDevice(@Req() req: Request, @Body() dto: UpdateDeviceDto) {
    return this.attendance.updateDevice(params(req).id, dto, (req.user as RequestUser).id);
  }

  @Post("devices/:id/rotate-key")
  @RequirePermissions("settings.manage")
  rotateKey(@Req() req: Request) {
    return this.attendance.rotateDeviceKey(params(req).id, (req.user as RequestUser).id);
  }

  @Delete("devices/:id/api-key")
  @RequirePermissions("settings.manage")
  revokeKey(@Req() req: Request) {
    return this.attendance.revokeDeviceKey(params(req).id, (req.user as RequestUser).id);
  }

  @Get("devices/:id/health")
  @RequirePermissions("attendance.read")
  health(@Req() req: Request) {
    return this.attendance.deviceHealth(params(req).id);
  }

  @Get("devices/:id/sync-runs")
  @RequirePermissions("attendance.read")
  syncRuns(@Req() req: Request) {
    return this.attendance.listSyncRuns(params(req).id);
  }

  @Get("devices/:id/mappings")
  @RequirePermissions("attendance.read")
  mappings(@Req() req: Request) {
    return this.attendance.listMappings(params(req).id);
  }

  @Post("devices/:id/mappings")
  @RequirePermissions("attendance.correct")
  upsertMapping(@Req() req: Request, @Body() dto: UpsertMappingDto) {
    return this.attendance.upsertMapping(
      params(req).id,
      dto.deviceUserId,
      dto.memberId,
      (req.user as RequestUser).id,
    );
  }

  @Delete("devices/:deviceId/mappings/:mappingId")
  @RequirePermissions("settings.manage")
  deleteMapping(@Req() req: Request) {
    const p = params(req);
    return this.attendance.deleteMapping(p.deviceId, p.mappingId, (req.user as RequestUser).id);
  }

  @Post("devices/:id/simulate")
  @RequirePermissions("settings.manage")
  simulate(@Req() req: Request, @Body() dto: SimulateDto) {
    return this.attendance.simulate(
      params(req).id,
      dto.count ?? 10,
      dto.memberIds ?? [],
      (req.user as RequestUser).id,
    );
  }

  // ----- exports -----

  @Get("exports/attendance")
  @RequirePermissions("data.export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="attendance.csv"')
  exportCsv(@Query() query: { from?: string; to?: string; memberId?: string }) {
    return this.attendance.exportCsv(query);
  }
}
