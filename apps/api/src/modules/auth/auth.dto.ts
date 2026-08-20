import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class RegisterDto extends LoginDto {
  @IsString() @MinLength(2) @MaxLength(60) displayName!: string;
}
