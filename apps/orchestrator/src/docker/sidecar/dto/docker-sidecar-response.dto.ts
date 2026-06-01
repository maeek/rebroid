import { ApiProperty } from '@nestjs/swagger';

export class DockerSidecarAdminSessionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  applicationId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ownerUserId!: string | null;

  @ApiProperty({ enum: ['created', 'active', 'released', 'expired'] })
  status!: 'created' | 'active' | 'released' | 'expired';

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  lastActivityAt!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty({ type: [String] })
  capabilities!: string[];
}
