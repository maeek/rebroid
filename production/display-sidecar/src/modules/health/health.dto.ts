import { ApiProperty } from '@nestjs/swagger';

class HealthAuthDto {
  @ApiProperty({ example: true })
  sharedSecretConfigured!: boolean;
}

export class HealthDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: 'rebroid-display-sidecar' })
  service!: string;

  @ApiProperty({ example: 8000 })
  port!: number;

  @ApiProperty({ type: HealthAuthDto })
  auth!: HealthAuthDto;
}
