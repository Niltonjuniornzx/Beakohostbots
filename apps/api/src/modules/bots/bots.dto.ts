import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateBotDto {
  @IsString() @MinLength(2) @MaxLength(50) name!: string;
  @IsIn(['NODEJS', 'PYTHON']) language!: 'NODEJS' | 'PYTHON';
  @IsIn(['20', '22', '3.11', '3.12']) version!: string;
  @IsIn(['ALPINE', 'SLIM']) variant!: 'ALPINE' | 'SLIM';
  @IsString() @Matches(/^[a-zA-Z0-9_./-]+$/) @MaxLength(120) entrypoint!: string;
}
