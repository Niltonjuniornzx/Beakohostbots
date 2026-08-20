import { ArrayMaxSize, IsArray, IsBase64, IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
