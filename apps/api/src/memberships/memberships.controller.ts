import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { MembershipsService } from "./memberships.service.js";
import {
  CancelDto,
  CreateMembershipDto,
  ExtendDto,
  MembershipListQuery,
  RenewMembershipDto,
  SuspendDto,
} from "./dto.js";
import { RequestUser, RequirePermissions } from "../auth/guards.js";

@ApiTags("memberships")
@Controller("memberships")
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  @RequirePermissions("members.read")
  list(@Query() query: MembershipListQuery) {
    return this.memberships.list(query);
  }

  @Get("by-member/:memberId/current")
  @RequirePermissions("members.read")
  current(@Req() req: Request) {
    return this.memberships.currentByMember((req.params as Record<string, string>).memberId);
  }

  @Get(":id")
  @RequirePermissions("members.read")
  get(@Req() req: Request) {
    return this.memberships.get((req.params as Record<string, string>).id);
  }

  @Post()
  @RequirePermissions("memberships.create")
  create(@Req() req: Request, @Body() dto: CreateMembershipDto) {
    return this.memberships.create(dto, (req.user as RequestUser).id);
  }

  @Post(":id/renew")
  @RequirePermissions("memberships.renew")
  renew(@Req() req: Request, @Body() dto: RenewMembershipDto) {
    return this.memberships.renew(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  @Patch(":id/extend")
  @RequirePermissions("memberships.renew")
  extend(@Req() req: Request, @Body() dto: ExtendDto, @Param("id") _id: string) {
    return this.memberships.extend(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  @Post(":id/suspend")
  @RequirePermissions("memberships.renew")
  suspend(@Req() req: Request, @Body() dto: SuspendDto) {
    return this.memberships.suspend(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  @Post(":id/resume")
  @RequirePermissions("memberships.renew")
  resume(@Req() req: Request) {
    return this.memberships.resume(
      (req.params as Record<string, string>).id,
      (req.user as RequestUser).id,
    );
  }

  @Post(":id/cancel")
  @RequirePermissions("memberships.renew")
  cancel(@Req() req: Request, @Body() dto: CancelDto) {
    return this.memberships.cancel(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }
}
