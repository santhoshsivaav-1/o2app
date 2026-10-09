import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AttendanceService } from "./attendance.service.js";
import { IngestBatchDto, IngestEventDto } from "./dto.js";
import { Public } from "../auth/guards.js";

/**
 * Device-connector ingress. Authenticates with the per-device API key
 * (NOT staff JWT — a gym PC has no user session), so it stays @Public to the
 * JWT guard and is exempt from the CSRF guard (see guards.ts allowlist).
 */
@ApiTags("devices")
@Controller("devices")
export class DeviceIngestController {
  constructor(private readonly attendance: AttendanceService) {}

  @Public()
  @HttpCode(200) // hardware connectors expect 200 (not Nest's POST-default 201)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post("events:ingest")
  ingest(@Body() dto: IngestBatchDto) {
    const events = Array.isArray(dto.events) ? dto.events.slice(0, 500) : [];
    return this.attendance.ingestWithKey(
      dto.deviceCode,
      dto.apiKey,
      events as IngestEventDto[],
      "device",
    );
  }
}
