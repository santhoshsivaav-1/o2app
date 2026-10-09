import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  deviceCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  duplicateWindowMin?: number;
}

export class UpsertMappingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  deviceUserId!: string;

  @IsUUID()
  memberId!: string;
}

export class IngestEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceEventId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  deviceUserId!: string;

  @IsString()
  occurredAt!: string;
}

export class IngestBatchDto {
  @IsString()
  deviceCode!: string;

  @IsString()
  apiKey!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestEventDto)
  events!: IngestEventDto[];
}

export class ManualCheckInDto {
  @IsUUID()
  memberId!: string;

  @IsOptional()
  @Matches(DATE_RE)
  date?: string;

  @IsOptional()
  @Matches(TIME_RE)
  time?: string;
}

export class CorrectRecordDto {
  @IsOptional()
  @Matches(DATE_RE)
  date?: string;

  @IsOptional()
  @Matches(TIME_RE)
  checkInTime?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class MapUnmappedDto {
  @IsUUID()
  memberId!: string;
}

export class SimulateDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;

  @IsOptional()
  @IsUUID(undefined, { each: true })
  memberIds?: string[];
}

export class AttendanceListQuery {
  @IsOptional()
  @Matches(DATE_RE)
  date?: string;

  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Matches(DATE_RE)
  from?: string;

  @IsOptional()
  @Matches(DATE_RE)
  to?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  includeValidity?: string;
}
