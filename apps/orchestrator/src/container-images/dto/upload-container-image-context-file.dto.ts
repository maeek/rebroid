import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UploadContainerImageContextFileDto {
  @ApiProperty({ example: 'apks/microg.apk' })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  contextPath!: string;
}
