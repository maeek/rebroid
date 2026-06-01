import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class LookupUploadedApkDto {
  @ApiProperty({
    example: '9d1e7fdf5f9f4d0e9f3e3a7a66a9ac884e7b68be3e0dd41d7dfc9f4e5ddbdc91',
  })
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  sha256!: string;

  @ApiPropertyOptional({ example: 'admin', nullable: true })
  @IsOptional()
  @IsString()
  ownerUserId?: string;
}
