import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "./prisma.service.js";
import { Public } from "./auth/guards.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get("live")
  live() {
    return { ok: true, service: "api", time: new Date().toISOString() };
  }

  @Public()
  @Get("ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: "up" };
    } catch (e) {
      return { ok: false, db: "down", error: (e as Error).message };
    }
  }
}
