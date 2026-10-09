import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class AllocationDto {
  @IsUUID()
  invoiceId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class CreatePaymentDto {
  @IsUUID()
  memberId!: string;

  @IsString()
  method!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @Matches(DATE_RE)
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;
}

export class RefundDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}

export class PaymentListQuery {
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @Matches(DATE_RE)
  from?: string;

  @IsOptional()
  @Matches(DATE_RE)
  to?: string;
}

export class InvoiceListQuery {
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsIn(["unpaid", "partial", "paid", "refunded"])
  status?: string;

  @IsOptional()
  @Matches(DATE_RE)
  from?: string;

  @IsOptional()
  @Matches(DATE_RE)
  to?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export class ReportRangeQuery {
  @Matches(DATE_RE)
  from!: string;

  @Matches(DATE_RE)
  to!: string;
}
