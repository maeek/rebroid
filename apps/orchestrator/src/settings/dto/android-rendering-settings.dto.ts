import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  androidRenderingModes,
  drmRenderDeviceMaxLength,
  drmRenderDevicePattern,
  type AndroidRenderingSettings,
} from '@rebroid/android-application-core/redroid-runtime';

export class AndroidRenderingSettingsDto implements AndroidRenderingSettings {
  @ApiProperty({ enum: androidRenderingModes })
  @IsIn(androidRenderingModes)
  mode!: AndroidRenderingSettings['mode'];

  @ApiProperty({ type: String, nullable: true, example: '/dev/dri/renderD128' })
  @ValidateIf(
    (dto: AndroidRenderingSettingsDto) =>
      dto.mode === 'host' || dto.renderDevice !== null,
  )
  @IsString()
  @MaxLength(drmRenderDeviceMaxLength)
  @Matches(drmRenderDevicePattern, {
    message: 'Enter a DRM render device such as /dev/dri/renderD128.',
  })
  renderDevice!: string | null;
}
