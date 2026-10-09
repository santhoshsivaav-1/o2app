import { Body, Controller, Get, Header, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { BillingService } from "./billing.service.js";
import {
  CreatePaymentDto,
  InvoiceListQuery,
  PaymentListQuery,
  RefundDto,
  ReportRangeQuery,
} from "./dto.js";
import { RequestUser, RequirePermissions } from "../auth/guards.js";

@ApiTags("billing")
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ----- payments -----

  @Post("payments")
  @RequirePermissions("payments.collect")
  record(@Req() req: Request, @Body() dto: CreatePaymentDto) {
    return this.billing.recordPayment(dto, (req.user as RequestUser).id);
  }

  @Get("payments")
  @RequirePermissions("payments.collect")
  listPayments(@Query() query: PaymentListQuery & { page?: string; limit?: string }) {
    return this.billing.listPayments(query);
  }

  @Get("payments/:id")
  @RequirePermissions("payments.collect")
  getPayment(@Req() req: Request) {
    return this.billing.getPayment((req.params as Record<string, string>).id);
  }

  @Post("payments/:id/refund")
  @RequirePermissions("payments.refund")
  refund(@Req() req: Request, @Body() dto: RefundDto) {
    return this.billing.refund(
      (req.params as Record<string, string>).id,
      dto,
      (req.user as RequestUser).id,
    );
  }

  // ----- invoices -----

  @Get("invoices")
  @RequirePermissions("payments.collect")
  listInvoices(@Query() query: InvoiceListQuery & { page?: string; limit?: string }) {
    return this.billing.listInvoices(query);
  }

  @Get("invoices/:id")
  @RequirePermissions("payments.collect")
  getInvoice(@Req() req: Request) {
    return this.billing.getInvoice((req.params as Record<string, string>).id);
  }

  // ----- financial reports (Phase 8 completes the catalogue) -----

  @Get("reports/collections")
  @RequirePermissions("reports.financial.read")
  collections(@Query() query: ReportRangeQuery) {
    return this.billing.collections(query);
  }

  @Get("reports/outstanding")
  @RequirePermissions("reports.financial.read")
  outstanding() {
    return this.billing.outstandingList();
  }

  @Get("reports/refunds")
  @RequirePermissions("reports.financial.read")
  refunds(@Query() query: ReportRangeQuery) {
    return this.billing.refundsReport(query);
  }

  // ----- exports -----

  @Get("exports/payments")
  @RequirePermissions("data.export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="payments.csv"')
  exportPayments(@Query() query: PaymentListQuery) {
    return this.billing.exportPayments(query);
  }

  @Get("exports/invoices")
  @RequirePermissions("data.export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="invoices.csv"')
  exportInvoices(@Query() query: InvoiceListQuery) {
    return this.billing.exportInvoices(query);
  }

  @Get("exports/collections")
  @RequirePermissions("data.export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="collections.csv"')
  exportCollections(@Query() query: ReportRangeQuery) {
    return this.billing.exportCollections(query);
  }

  @Get("exports/outstanding")
  @RequirePermissions("data.export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="outstanding.csv"')
  exportOutstanding() {
    return this.billing.exportOutstanding();
  }
}
