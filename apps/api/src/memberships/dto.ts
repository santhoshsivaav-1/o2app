import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateMembershipDto {
  @IsUUID()
  memberId!: string;

  @IsUUID()
  packageId!: string;

  @IsOptional()
  @Matches(DATE_RE)
  startDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;
}

export class RenewMembershipDto {
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @Matches(DATE_RE)
  startDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;
}

export class ExtendDto {
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SuspendDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CancelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class MembershipListQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @IsIn(["active", "suspended", "cancelled"])
  status?: string;

  @IsOptional()
  @IsIn(["scheduled", "active", "expired", "suspended", "cancelled"])
  validity?: string;

  @IsOptional()
  @Matches(DATE_RE)
  expiringBefore?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
