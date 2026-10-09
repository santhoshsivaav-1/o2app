import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import { CreateGenderDto, UpdateGenderDto } from "./dto.js";
import { RequestUser, RequirePermissions } from "../auth/guards.js";

@ApiTags("genders")
@Controller("genders")
export class GendersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query("includeInactive") includeInactive?: string) {
    const all = includeInactive === "true" || includeInactive === "1";
    return this.prisma.genderCategory.findMany({
      where: all ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  @Post()
  @RequirePermissions("settings.manage")
  async create(@Req() req: Request, @Body() dto: CreateGenderDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.genderCategory.findUnique({ where: { name } });
    if (existing) throw new ConflictException("Gender category already exists");
    const gender = await this.prisma.genderCategory.create({ data: { name } });
    await this.audit.log(
      "settings.gender_create",
      "gender",
      gender.id,
      (req.user as RequestUser).id,
    );
    return gender;
  }

  @Patch(":id")
  @RequirePermissions("settings.manage")
  async update(@Req() req: Request, @Body() dto: UpdateGenderDto) {
    const id = (req.params as Record<string, string>).id;
    const existing = await this.prisma.genderCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Gender category not found");
    const gender = await this.prisma.genderCategory.update({
      where: { id },
      data: { name: dto.name?.trim(), isActive: dto.isActive },
    });
    await this.audit.log("settings.gender_update", "gender", id, (req.user as RequestUser).id);
    return gender;
  }
}
