import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ApplicationViewerActivityDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  runtimeKey!: string;
}
