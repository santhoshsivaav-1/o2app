import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { formatMemberCode } from "@o2app/shared";

/** Transactional per-year sequences (member codes, later invoice numbers). */
@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async nextMemberCode(year: number): Promise<string> {
    const counter = await this.prisma.seqCounter.upsert({
      where: { name_year: { name: "member", year } },
      create: { name: "member", year, last: 1 },
      update: { last: { increment: 1 } },
    });
    return formatMemberCode(year, counter.last);
  }
}
