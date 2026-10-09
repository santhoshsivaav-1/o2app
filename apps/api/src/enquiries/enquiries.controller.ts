import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { EnquiriesService } from "./enquiries.service.js";
import {
  CompleteFollowUpDto,
  ConvertEnquiryDto,
  CreateEnquiryDto,
  CreateFollowUpDto,
  EnquiryListQuery,
  EnquiryReportQuery,
  FollowUpQueueQuery,
  UpdateEnquiryDto,
} from "./dto.js";
import { RequestUser, RequirePermissions } from "../auth/guards.js";

@ApiTags("enquiries")
@Controller()
@RequirePermissions("enquiries.manage")
export class EnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Get("enquiries")
  list(
    @Query()
    query: EnquiryListQuery & { page?: string; limit?: string; sort?: string; order?: string },
  ) {
    return this.enquiries.list(query);
  }

  @Get("enquiries/sources")
  sources() {
    return this.enquiries.sources();
  }

  @Get("enquiries/assignees")
  assignees() {
    return this.enquiries.assignees();
  }

  @Get("enquiries/:id")
  get(@Req() req: Request) {
    return this.enquiries.get((req.params as Record<string, string>).id);
  }

  @Post("enquiries")
  create(@Req() req: Request, @Body() dto: CreateEnquiryDto) {
    return this.enquiries.create(dto, (req.user as RequestUser).id);
  }

  @Patch("enquiries/:id")
  update(@Req() req: Request, @Body() dto: UpdateEnquiryDto) {
    return this.enquiries.update(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  @Get("enquiries/:id/follow-ups")
  listFollowUps(@Req() req: Request) {
    return this.enquiries.listFollowUps((req.params as Record<string, string>).id);
  }

  @Post("enquiries/:id/follow-ups")
  addFollowUp(@Req() req: Request, @Body() dto: CreateFollowUpDto) {
    return this.enquiries.addFollowUp(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  @Post("enquiries/:id/convert")
  @RequirePermissions("enquiries.manage", "members.create")
  convert(@Req() req: Request, @Body() dto: ConvertEnquiryDto) {
    return this.enquiries.convert(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  @Patch("follow-ups/:id/complete")
  complete(@Req() req: Request, @Body() dto: CompleteFollowUpDto, @Param("id") _id: string) {
    return this.enquiries.completeFollowUp(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  @Get("follow-ups")
  queue(@Query() query: FollowUpQueueQuery) {
    return this.enquiries.queue(query);
  }

  @Get("reports/enquiries")
  report(@Query() query: EnquiryReportQuery) {
    return this.enquiries.report(query);
  }
}
