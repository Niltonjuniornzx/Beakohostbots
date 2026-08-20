import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateNodeDto {
  @IsString() @MinLength(2) @MaxLength(50) name!: string;
}
export class UpdateNodeDto { @IsIn(['PENDING', 'DRAINING', 'OFFLINE']) status!: 'PENDING'|'DRAINING'|'OFFLINE'; }
export class UpdateUserDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'BANNED']) status!: 'ACTIVE'|'SUSPENDED'|'BANNED';
  @IsIn(['USER', 'ADMIN']) role!: 'USER'|'ADMIN';
}
export class MoveBotDto { @IsString() nodeId!: string; }
export class UserLimitsDto {
  @IsInt() @Min(0) @Max(1000) maxBots!: number;
  @IsInt() @Min(10) @Max(256000) cpuMillicores!: number;
  @IsInt() @Min(10) @Max(256000) totalCpuMillicores!: number;
  @IsInt() @Min(32) @Max(2097152) memoryMb!: number;
  @IsInt() @Min(32) @Max(2097152) totalMemoryMb!: number;
  @IsInt() @Min(32) @Max(2097152) memorySwapMb!: number;
  @IsInt() @Min(10) diskMb!: number;
  @IsInt() @Min(0) bandwidthIngressMb!: number;
  @IsInt() @Min(0) bandwidthEgressMb!: number;
  @IsInt() @Min(0) networkRateKbps!: number;
  @IsInt() @Min(10) @Max(100000) pidsLimit!: number;
  @IsInt() @Min(1) @Max(102400) maxUploadMb!: number;
  @IsInt() @Min(0) sftpRateKbps!: number;
  @IsIn(['NEVER','ON_FAILURE','ALWAYS','UNLESS_STOPPED']) restartPolicy!: 'NEVER'|'ON_FAILURE'|'ALWAYS'|'UNLESS_STOPPED';
  @IsInt() @Min(0) @Max(100) maxRestartCount!: number;
  @IsInt() @Min(30) @Max(86400) crashLoopWindowSeconds!: number;
  @IsBoolean() suspendOnTrafficLimit!: boolean;
  @IsBoolean() pauseOnCriticalUsage!: boolean;
}

export class SavePlanDto extends UserLimitsDto {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsOptional() @IsString() @MaxLength(240) description?: string;
  @IsBoolean() isDefault!: boolean;
  @IsBoolean() enabled!: boolean;
}

export class AssignPlanDto { @IsOptional() @IsString() planId?: string; }

export class DiscordSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @MinLength(10) @MaxLength(40) clientId!: string;
  @IsOptional() @IsString() @MinLength(20) @MaxLength(200) clientSecret?: string;
  @IsString() @MinLength(10) @MaxLength(500) redirectUri!: string;
}
