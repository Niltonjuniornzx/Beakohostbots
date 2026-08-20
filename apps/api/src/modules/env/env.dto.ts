import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const envKeyPattern = /^[A-Z_][A-Z0-9_]{0,63}$/;
export class CreateEnvDto { @IsString() @Matches(envKeyPattern) key!: string; @IsString() @MaxLength(16384) value!: string; @IsBoolean() isSecret!: boolean; @IsOptional() @IsBoolean() restart?: boolean; }
export class UpdateEnvDto { @IsOptional() @IsString() @Matches(envKeyPattern) key?: string; @IsOptional() @IsString() @MaxLength(16384) value?: string; @IsOptional() @IsBoolean() isSecret?: boolean; @IsOptional() @IsBoolean() restart?: boolean; }
export class ImportEnvDto { @IsBoolean() confirm!: boolean; @IsOptional() @IsBoolean() restart?: boolean; }
export class BulkEnvDto { @IsString() @MinLength(1) @MaxLength(65536) content!: string; @IsBoolean() isSecret!: boolean; @IsOptional() @IsBoolean() restart?: boolean; }
