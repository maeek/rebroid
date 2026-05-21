import { ApiProperty } from '@nestjs/swagger';

export class AndroidNotificationDto {
  @ApiProperty({ example: 'android' })
  packageName!: string;

  @ApiProperty({ example: 'System UI' })
  title!: string;

  @ApiProperty({ example: 'VPN is active' })
  text!: string;

  @ApiProperty({ example: 'NotificationRecord(...)' })
  raw!: string;
}
