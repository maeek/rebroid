import { ApiProperty } from '@nestjs/swagger';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';

export class AndroidApplicationViewerRuntimeDto {
  @ApiProperty({ type: String, nullable: true })
  ownerUserId!: string | null;

  @ApiProperty({ enum: AndroidApplicationStatus })
  status!: AndroidApplicationStatus;

  @ApiProperty({ type: String, nullable: true })
  containerId!: string | null;
}
