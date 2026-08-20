import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBase64, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateBotDto {
  @IsString() @MinLength(2) @MaxLength(50) name!: string;
  @IsIn(['NODEJS', 'PYTHON']) language!: 'NODEJS' | 'PYTHON';
  @IsIn(['20', '22', '24', '26', '3.10', '3.11', '3.12', '3.13', '3.14']) version!: string;
  @IsIn(['ALPINE', 'SLIM']) variant!: 'ALPINE' | 'SLIM';
  @IsString() @Matches(/^[a-zA-Z0-9_./-]+$/) @MaxLength(120) entrypoint!: string;
}

export class BotFileDto {
  @IsString() @MinLength(1) @MaxLength(240) @Matches(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./@()+ -]+$/) path!: string;
  @IsString() @IsBase64() contentBase64!: string;
}

export class BotFilePathDto {
  @IsString() @MinLength(1) @MaxLength(240) @Matches(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./@()+ -]+$/) path!: string;
}
export class BotActionDto { @IsIn(['SYNC','INSTALL','START','STOP','RESTART']) action!: 'SYNC'|'INSTALL'|'START'|'STOP'|'RESTART'; }
export class InstallDependenciesDto {
  @IsArray() @ArrayMaxSize(100) @IsString({each:true}) @Matches(/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i,{each:true}) packages!: string[];
}
const safePath=/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./@()+ -]+$/;
export class CreateEntryDto { @IsString() @MinLength(1) @MaxLength(240) @Matches(safePath) path!:string; @IsIn(['FILE','DIRECTORY']) type!:'FILE'|'DIRECTORY'; }
export class RenameEntryDto { @IsString() @MinLength(1) @MaxLength(240) @Matches(safePath) from!:string; @IsString() @MinLength(1) @MaxLength(240) @Matches(safePath) to!:string; }
export class MoveEntriesDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsString({each:true}) @Matches(safePath,{each:true}) paths!:string[]; @IsString() @MaxLength(240) @Matches(/^(?:$|(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./@()+ -]+)$/) destination!:string; }
export class DeleteEntriesDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsString({each:true}) @Matches(safePath,{each:true}) paths!:string[]; }
export class ExtractArchiveDto { @IsString() @MinLength(1) @MaxLength(240) @Matches(safePath) path!:string; @IsOptional() @IsString() @MaxLength(240) @Matches(safePath) destination?:string; @IsOptional() @IsBoolean() deleteArchive?:boolean; }
export class UpdateBotLimitsDto {
  @IsInt() @Min(25) @Max(64000) cpuMillicores!:number;
  @IsInt() @Min(32) @Max(262144) memoryMb!:number;
  @IsInt() @Min(64) @Max(10485760) diskMb!:number;
}
export class BotFilesBatchDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>BotFileDto) files!:BotFileDto[]; }
export class UpdateStartupDto { @IsString() @MinLength(1) @MaxLength(120) @Matches(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./@()+ -]+$/) entrypoint!:string; }
