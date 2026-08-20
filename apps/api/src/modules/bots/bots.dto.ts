import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateBotDto {
  @IsString() @MinLength(2) @MaxLength(50) name!: string;
  @IsIn(['NODEJS', 'PYTHON']) language!: 'NODEJS' | 'PYTHON';
  @IsIn(['20', '22', '24', '26', '3.10', '3.11', '3.12', '3.13', '3.14']) version!: string;
  @IsIn(['ALPINE', 'SLIM']) variant!: 'ALPINE' | 'SLIM';
  @IsString() @Matches(/^[a-zA-Z0-9_./-]+$/) @MaxLength(120) entrypoint!: string;
}
