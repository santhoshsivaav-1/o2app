import {
  IsBoolean,
  IsEmail,
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

export class CreateMemberDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(17)
  mobile!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsUUID()
  genderId!: string;

  @IsOptional()
  @Matches(DATE_RE)
  dob?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContact?: string;

  @IsOptional()
  @Matches(DATE_RE)
  registrationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @IsUUID()
  assignedTrainerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceUserId?: string;

  @IsOptional()
  @IsBoolean()
  confirmDuplicate?: boolean;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(17)
  mobile?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsUUID()
  genderId?: string;

  @IsOptional()
  @Matches(DATE_RE)
  dob?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContact?: string;

  @IsOptional()
  @Matches(DATE_RE)
  registrationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsIn(["active", "inactive", "archived"])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @IsUUID()
  assignedTrainerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceUserId?: string;

  @IsOptional()
  @IsBoolean()
  confirmDuplicate?: boolean;
}

export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class CreatePackageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @Min(1)
  durationValue!: number;

  @IsIn(["DAY", "MONTH"])
  durationUnit!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  registrationFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountMaxPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  gstPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  eligibility?: string;
}

export class UpdatePackageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationValue?: number;

  @IsOptional()
  @IsIn(["DAY", "MONTH"])
  durationUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  registrationFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountMaxPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  gstPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  eligibility?: string;
}

export class CreateGenderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;
}

export class UpdateGenderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
