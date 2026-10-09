import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const ENQUIRY_STATUS_KEYS = [
  "new",
  "contacted",
  "follow_up",
  "trial",
  "interested",
  "converted",
  "lost",
] as const;

export const FOLLOW_UP_ACTIVITIES = ["call", "visit", "trial", "note", "other"] as const;

export class CreateEnquiryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(17)
  phone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  interest?: string;

  @IsOptional()
  @IsUUID()
  interestPackageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @Matches(DATE_RE)
  enquiryDate?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsIn(["new", "contacted", "follow_up", "trial", "interested", "lost"])
  status?: string;

  @IsOptional()
  @IsString()
  nextFollowUpAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateEnquiryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(17)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  interest?: string;

  @IsOptional()
  @IsUUID()
  interestPackageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @Matches(DATE_RE)
  enquiryDate?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @IsOptional()
  @IsIn(["new", "contacted", "follow_up", "trial", "interested", "lost"])
  status?: string;

  @IsOptional()
  @IsString()
  nextFollowUpAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateFollowUpDto {
  @IsIn(["call", "visit", "trial", "note", "other"])
  activity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;
}

export class CompleteFollowUpDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ConvertEnquiryDto {
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
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  confirmDuplicate?: boolean;
}

export class EnquiryListQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  overdue?: string;

  @IsOptional()
  @Matches(DATE_RE)
  from?: string;

  @IsOptional()
  @Matches(DATE_RE)
  to?: string;
}

export class FollowUpQueueQuery {
  @IsOptional()
  @IsIn(["overdue", "upcoming", "all"])
  scope?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  days?: string;
}

export class EnquiryReportQuery {
  @Matches(DATE_RE)
  from!: string;

  @Matches(DATE_RE)
  to!: string;
}
