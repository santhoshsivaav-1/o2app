import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { packageDurationDays } from "@o2app/shared";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import { CreatePackageDto, UpdatePackageDto } from "./dto.js";
import { RequestUser, RequirePermissions } from "../auth/guards.js";

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private days(value: number, unit: string): number {
    try {
      return packageDurationDays(value, unit as "DAY" | "MONTH");
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  list(includeInactive: boolean) {
    return this.prisma.package.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException("Package not found");
    return pkg;
  }

  async create(dto: CreatePackageDto, actorId: string) {
    const pkg = await this.prisma.package.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        durationValue: dto.durationValue,
        durationUnit: dto.durationUnit,
        durationDays: this.days(dto.durationValue, dto.durationUnit),
        price: dto.price,
        registrationFee: dto.registrationFee ?? 0,
        discountMaxPct: dto.discountMaxPct,
        gstPercent: dto.gstPercent,
        isActive: dto.isActive ?? true,
        eligibility: dto.eligibility?.trim() || null,
        createdById: actorId,
      },
    });
    await this.audit.log("packages.create", "package", pkg.id, actorId);
    return pkg;
  }

  async update(id: string, dto: UpdatePackageDto, actorId: string) {
    const existing = await this.prisma.package.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Package not found");
    const durationValue = dto.durationValue ?? existing.durationValue;
    const durationUnit = dto.durationUnit ?? existing.durationUnit;
    const pkg = await this.prisma.package.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description !== undefined ? dto.description.trim() || null : undefined,
        durationValue,
        durationUnit,
        durationDays: this.days(durationValue, durationUnit),
        price: dto.price,
        registrationFee: dto.registrationFee,
        discountMaxPct: dto.discountMaxPct,
        gstPercent: dto.gstPercent,
        isActive: dto.isActive,
        eligibility: dto.eligibility !== undefined ? dto.eligibility.trim() || null : undefined,
        updatedById: actorId,
      },
    });
    await this.audit.log("packages.update", "package", id, actorId);
    return pkg;
  }

  async deactivate(id: string, actorId: string) {
    const existing = await this.prisma.package.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Package not found");
    // Deactivation never destroys history — existing memberships keep referencing the row (Phase 4+).
    const pkg = await this.prisma.package.update({ where: { id }, data: { isActive: false } });
    await this.audit.log("packages.deactivate", "package", id, actorId);
    return pkg;
  }
}

@ApiTags("packages")
@Controller("packages")
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  list(@Query("includeInactive") includeInactive?: string) {
    return this.packages.list(includeInactive === "true" || includeInactive === "1");
  }

  @Get(":id")
  get(@Param("id") _id: string, @Req() req: Request) {
    return this.packages.get((req.params as Record<string, string>).id);
  }

  @Post()
  @RequirePermissions("settings.manage")
  create(@Req() req: Request, @Body() dto: CreatePackageDto) {
    return this.packages.create(dto, (req.user as RequestUser).id);
  }

  @Patch(":id")
  @RequirePermissions("settings.manage")
  update(@Req() req: Request, @Body() dto: UpdatePackageDto) {
    return this.packages.update(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  @Post(":id/deactivate")
  @RequirePermissions("settings.manage")
  deactivate(@Req() req: Request) {
    return this.packages.deactivate(
      (req.params as Record<string, string>).id,
      (req.user as RequestUser).id,
    );
  }
}
