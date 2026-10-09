import { Controller, Get, Query } from "@nestjs/common";
import { ReportsService } from "./reports.service.js";
import { RequirePermissions } from "../auth/guards.js";

@Controller("reports")
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get("dashboard/owner")
  @RequirePermissions("reports.read")
  getOwnerDashboard() {
    return this.reports.getOwnerDashboard();
  }

  @Get("expiring-memberships")
  @RequirePermissions("reports.read")
  getExpiringMemberships(@Query("days") days?: string) {
    return this.reports.getMembershipExpiryReport(days ? parseInt(days, 10) : 30);
  }

  @Get("monthly-demographics")
  @RequirePermissions("reports.read")
  getMonthlyDemographics(@Query("start") start?: string, @Query("end") end?: string) {
    return this.reports.getMonthlyDemographics(start, end);
  }

  @Get("enquiries")
  @RequirePermissions("reports.read")
  getEnquiriesReport(@Query("start") start?: string, @Query("end") end?: string) {
    return this.reports.getEnquiriesReport(start, end);
  }

  @Get("billings")
  @RequirePermissions("reports.read")
  getBillingsReport(@Query("start") start?: string, @Query("end") end?: string) {
    return this.reports.getBillingsReport(start, end);
  }
}
