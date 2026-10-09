import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(10)
  newPassword!: string;
}

export class AdminResetDto {
  @IsString()
  @MinLength(10)
  newPassword!: string;
}

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsString({ each: true })
  roleIds!: string[];
}

export class UpdateUserDto {
  @IsString()
  name?: string;

  isActive?: boolean;

  @IsString({ each: true })
  roleIds?: string[];
}

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class SetRolePermissionsDto {
  @IsString({ each: true })
  permissionKeys!: string[];
}
