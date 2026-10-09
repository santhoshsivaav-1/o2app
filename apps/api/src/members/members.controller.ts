import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { MembersService } from "./members.service.js";
import { CreateMemberDto, CreateNoteDto, UpdateMemberDto } from "./dto.js";
import { RequestUser, RequirePermissions } from "../auth/guards.js";

@ApiTags("members")
@Controller("members")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermissions("members.read")
  list(@Query() query: Record<string, string>) {
    return this.members.list(query);
  }

  @Get("export")
  @RequirePermissions("data.export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="members.csv"')
  export(@Query() query: Record<string, string>) {
    return this.members.exportCsv(query);
  }

  @Get("check-duplicate")
  @RequirePermissions("members.read")
  async checkDuplicate(@Query("mobile") mobile: string) {
    if (!mobile) return { matches: [] };
    const { data } = await this.members.list({ q: mobile, limit: "5" });
    return { matches: data };
  }

  @Post()
  @RequirePermissions("members.create")
  create(@Req() req: Request, @Body() dto: CreateMemberDto) {
    return this.members.create(dto, (req.user as RequestUser).id);
  }

  @Get(":id")
  @RequirePermissions("members.read")
  get(@Req() req: Request) {
    return this.members.get((req.params as Record<string, string>).id);
  }

  @Patch(":id")
  @RequirePermissions("members.update")
  update(@Req() req: Request, @Body() dto: UpdateMemberDto) {
    return this.members.update(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  @Post(":id/archive")
  @RequirePermissions("members.archive")
  archive(@Req() req: Request) {
    return this.members.archive(
      (req.params as Record<string, string>).id,
      (req.user as RequestUser).id,
    );
  }

  @Post(":id/restore")
  @RequirePermissions("members.archive")
  restore(@Req() req: Request) {
    return this.members.restore(
      (req.params as Record<string, string>).id,
      (req.user as RequestUser).id,
    );
  }

  @Post(":id/notes")
  @RequirePermissions("members.update")
  addNote(@Req() req: Request, @Body() dto: CreateNoteDto, @Param("id") _id: string) {
    const id = (req.params as Record<string, string>).id;
    return this.members.addNote(id, dto.body, (req.user as RequestUser).id);
  }
}
