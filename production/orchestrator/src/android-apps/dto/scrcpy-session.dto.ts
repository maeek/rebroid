import { ApiProperty } from '@nestjs/swagger';
import { ScrcpyTransport } from '../android-application-status';

export class ScrcpySessionDto {
  @ApiProperty()
  applicationId!: string;

  @ApiProperty({ enum: ScrcpyTransport })
  transport!: ScrcpyTransport;

  @ApiProperty()
  websocketUrl!: string;

  @ApiProperty()
  adbHost!: string;

  @ApiProperty()
  adbPort!: number;
}
