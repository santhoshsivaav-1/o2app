import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import { hashPassword } from "../crypto.js";
import { CreateUserDto, UpdateUserDto } from "./dto.js";
import { RequestUser, RequirePermissions } from "./guards.js";

@ApiTags("users")
@Controller("users")
@RequirePermissions("staff.manage")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
    return users.map((u) => ({ ...u, roles: u.userRoles.map((r) => r.role) }));
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const me = req.user as RequestUser;
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException("Email already in use");
    const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } });
    if (roles.length !== dto.roleIds.length) throw new BadRequestException("Unknown role id");
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash: await hashPassword(dto.password),
        userRoles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
    });
    await this.audit.log("staff.user_create", "user", user.id, me.id);
    return { id: user.id, email: user.email, name: user.name };
  }

  @Patch(":id")
  async update(@Req() req: Request, @Body() dto: UpdateUserDto) {
    const me = req.user as RequestUser;
    const id = (req.params as Record<string, string>).id;
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException("User not found");
    if (dto.isActive === false) {
      // Never deactivate the last active owner.
      const isOwner = target.userRoles.some((r) => r.role.name === "owner");
      if (isOwner) {
        const otherOwners = await this.prisma.userRole.count({
          where: { role: { name: "owner" }, user: { isActive: true, id: { not: id } } },
        });
        if (otherOwners === 0)
          throw new ConflictException("Cannot deactivate the last active owner");
      }
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (dto.roleIds) {
      const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } });
      if (roles.length !== dto.roleIds.length) throw new BadRequestException("Unknown role id");
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
      });
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive },
      select: { id: true, email: true, name: true, isActive: true },
    });
    await this.audit.log("staff.user_update", "user", id, me.id);
    return updated;
  }

  @Get(":id")
  async get(@Param("id") _id: string, @Req() req: Request) {
    const id = (req.params as Record<string, string>).id;
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    return { ...user, roles: user.userRoles.map((r) => r.role) };
  }
}
