import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ListAndroidApplicationsDto } from './list-android-applications.dto';

export class ListAndroidApplicationNavigationDto extends ListAndroidApplicationsDto {
  @ApiProperty({ type: [String], maxItems: 5 })
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID(undefined, { each: true })
  applicationIds!: string[];

  @ApiProperty()
  @IsBoolean()
  includeRunning!: boolean;

  @ApiPropertyOptional({ type: [String], maxItems: 512 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(512)
  @IsUUID(undefined, { each: true })
  excludeIds?: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  runningLimit?: number;

  @ApiPropertyOptional({ description: 'Locale for the natural name ordering.' })
  @IsOptional()
  @Matches(/^[a-z]{2,8}(?:-[a-z0-9]{1,8}){0,5}$/i)
  locale?: string;
}
