import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, entity: string, entityId?: string, actorId?: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: { action, entity, entityId, actorId } });
    } catch {
      // Audit must never break the request path (e.g. table missing in early dev).
    }
  }
}
