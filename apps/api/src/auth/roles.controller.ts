import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PERMISSIONS } from "@o2app/shared";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import { CreateRoleDto, SetRolePermissionsDto } from "./dto.js";
import { RequestUser, RequirePermissions } from "./guards.js";

@ApiTags("roles")
@Controller()
export class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get("permissions")
  @RequirePermissions("roles.manage")
  listPermissions() {
    return { permissions: [...PERMISSIONS] };
  }

  @Get("roles")
  @RequirePermissions("roles.manage")
  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      userCount: r._count.userRoles,
      permissions: r.rolePermissions.map((p) => p.permission.key),
    }));
  }

  @Post("roles")
  @RequirePermissions("roles.manage")
  async createRole(@Req() req: Request, @Body() dto: CreateRoleDto) {
    const role = await this.prisma.role.create({ data: { name: dto.name.toLowerCase() } });
    await this.audit.log("staff.role_create", "role", role.id, (req.user as RequestUser).id);
    return { id: role.id, name: role.name };
  }

  @Patch("roles/:id")
  @RequirePermissions("roles.manage")
  async renameRole(@Req() req: Request, @Body() dto: CreateRoleDto) {
    const id = (req.params as Record<string, string>).id;
    const current = await this.prisma.role.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Role not found");
    if (current.name === "owner") throw new BadRequestException("The owner role cannot be renamed");
    const role = await this.prisma.role.update({
      where: { id },
      data: { name: dto.name.toLowerCase() },
    });
    await this.audit.log("staff.role_rename", "role", id, (req.user as RequestUser).id);
    return { id: role.id, name: role.name };
  }

  @Put("roles/:id/permissions")
  @RequirePermissions("roles.manage")
  async setPermissions(@Req() req: Request, @Body() dto: SetRolePermissionsDto) {
    const id = (req.params as Record<string, string>).id;
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Role not found");
    const unknown = dto.permissionKeys.filter(
      (k) => !(PERMISSIONS as readonly string[]).includes(k),
    );
    if (unknown.length > 0)
      throw new BadRequestException(`Unknown permissions: ${unknown.join(", ")}`);
    if (role.name === "owner" && dto.permissionKeys.length !== PERMISSIONS.length)
      throw new BadRequestException("The owner role must keep all permissions");
    const perms = await this.prisma.permission.findMany({
      where: { key: { in: dto.permissionKeys } },
    });
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: id, permissionId: p.id })),
      }),
    ]);
    await this.audit.log("staff.role_permissions", "role", id, (req.user as RequestUser).id);
    return { ok: true };
  }

  @Delete("roles/:id")
  @RequirePermissions("roles.manage")
  async deleteRole(@Req() req: Request) {
    const id = (req.params as Record<string, string>).id;
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!role) throw new NotFoundException("Role not found");
    if (role.name === "owner") throw new BadRequestException("The owner role cannot be deleted");
    if (role._count.userRoles > 0) throw new ConflictException("Role is assigned to users");
    await this.prisma.role.delete({ where: { id } });
    await this.audit.log("staff.role_delete", "role", id, (req.user as RequestUser).id);
    return { ok: true };
  }
}
