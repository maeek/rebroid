import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PullContainerImageDto {
  @ApiProperty({ example: 'redroid/redroid:14.0.0-latest' })
  @IsString()
  @MinLength(3)
  image!: string;
}
