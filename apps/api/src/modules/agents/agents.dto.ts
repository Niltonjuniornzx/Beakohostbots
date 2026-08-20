import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class EnrollAgentDto {
  @IsString() @MinLength(32) token!: string;
  @IsString() @MinLength(1) @MaxLength(30) agentVersion!: string;
  @IsInt() @Min(100) @Max(256000) totalCpuMillicores!: number;
  @IsInt() @Min(64) @Max(2097152) totalMemoryMb!: number;
  @IsInt() @Min(1024) totalDiskMb!: number;
}
export class HeartbeatDto {
  @IsString() @MinLength(1) @MaxLength(30) agentVersion!: string;
  @IsInt() @Min(100) totalCpuMillicores!: number;
  @IsInt() @Min(64) totalMemoryMb!: number;
  @IsInt() @Min(1024) totalDiskMb!: number;
}
