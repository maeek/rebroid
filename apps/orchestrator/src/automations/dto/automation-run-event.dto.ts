import { ApiProperty } from '@nestjs/swagger';

export class AutomationRunEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  runId!: string;

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  sequence!: number;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: String, nullable: true })
  stepId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  parentStepId!: string | null;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: Object })
  data!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;
}

export class AutomationRunEventStreamTokenDto {
  @ApiProperty()
  token!: string;

  @ApiProperty()
  expiresAt!: string;
}
