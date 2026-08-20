import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class EnrollAgentDto {
  @IsString() @MinLength(32) token!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) hostname?: string;
  @IsString() @MinLength(1) @MaxLength(30) agentVersion!: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(100) runnerInstanceId?: string;
  @IsInt() @Min(100) @Max(256000) totalCpuMillicores!: number;
  @IsInt() @Min(64) @Max(2097152) totalMemoryMb!: number;
  @IsInt() @Min(1024) totalDiskMb!: number;
  @IsArray() @ArrayMaxSize(30) @IsString({each:true}) runtimeImages!: string[];
  @IsString() @IsIn(['INSTALLING','READY','ERROR']) setupStatus!: string;
  @IsOptional() @IsString() @MaxLength(50000) setupLog?: string;
}
export class HeartbeatDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) hostname?: string;
  @IsString() @MinLength(1) @MaxLength(30) agentVersion!: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(100) runnerInstanceId?: string;
  @IsInt() @Min(100) totalCpuMillicores!: number;
  @IsInt() @Min(64) totalMemoryMb!: number;
  @IsInt() @Min(1024) totalDiskMb!: number;
  @IsArray() @ArrayMaxSize(30) @IsString({each:true}) runtimeImages!: string[];
  @IsString() @IsIn(['INSTALLING','READY','ERROR']) setupStatus!: string;
  @IsOptional() @IsString() @MaxLength(50000) setupLog?: string;
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
  @IsOptional() @IsNumber() @Min(0) @Max(10000) cpuUsagePercent?: number;
  @IsOptional() @IsInt() @Min(0) memoryUsageMb?: number;
  @IsOptional() @IsInt() @Min(0) diskUsageMb?: number;
  @IsOptional() @IsInt() @Min(0) networkIngressBytes?: number;
  @IsOptional() @IsInt() @Min(0) networkEgressBytes?: number;
  @IsOptional() @IsBoolean() oomKilled?: boolean;
}
