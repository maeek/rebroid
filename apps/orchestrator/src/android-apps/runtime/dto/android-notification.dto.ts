import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AndroidNotificationDto {
  @ApiProperty({ example: 'android' })
  packageName!: string;

  @ApiProperty({ example: 'System UI' })
  title!: string;

  @ApiProperty({ example: 'VPN is active' })
  text!: string;

  @ApiPropertyOptional({ type: String, example: 'Clock', nullable: true })
  appName!: string | null;

  @ApiProperty({ example: 'NotificationRecord(...)' })
  raw!: string;
}
