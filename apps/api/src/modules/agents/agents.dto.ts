import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class EnrollAgentDto {
  @IsString() @MinLength(32) token!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) hostname?: string;
  @IsString() @MinLength(1) @MaxLength(30) agentVersion!: string;
  @IsInt() @Min(100) @Max(256000) totalCpuMillicores!: number;
  @IsInt() @Min(64) @Max(2097152) totalMemoryMb!: number;
  @IsInt() @Min(1024) totalDiskMb!: number;
}
export class HeartbeatDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) hostname?: string;
  @IsString() @MinLength(1) @MaxLength(30) agentVersion!: string;
  @IsInt() @Min(100) totalCpuMillicores!: number;
  @IsInt() @Min(64) totalMemoryMb!: number;
  @IsInt() @Min(1024) totalDiskMb!: number;
}
export class CompleteJobDto {
  @IsBoolean() success!: boolean;
  @IsOptional() @IsString() @MaxLength(200000) output?: string;
  @IsOptional() @IsString() @MaxLength(4000) error?: string;
  @IsOptional() @IsString() @MaxLength(255) containerId?: string;
}
export class BotTelemetryDto {
  @IsBoolean() running!: boolean;
  @IsOptional() @IsInt() exitCode?: number;
  @IsString() @MaxLength(200000) logs!: string;
}
