import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateNodeDto {
  @IsString() @MinLength(2) @MaxLength(50) name!: string;
  @IsString() @MinLength(3) @MaxLength(255) hostname!: string;
  @IsInt() @Min(100) @Max(256000) totalCpuMillicores!: number;
  @IsInt() @Min(128) @Max(2097152) totalMemoryMb!: number;
  @IsInt() @Min(1024) totalDiskMb!: number;
}
export class UpdateNodeDto { @IsIn(['PENDING', 'DRAINING', 'OFFLINE']) status!: 'PENDING'|'DRAINING'|'OFFLINE'; }
export class UpdateUserDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'BANNED']) status!: 'ACTIVE'|'SUSPENDED'|'BANNED';
  @IsIn(['USER', 'ADMIN']) role!: 'USER'|'ADMIN';
}
export class MoveBotDto { @IsString() nodeId!: string; }
