import { ApiProperty } from '@nestjs/swagger';

import {
  automationRunEventTypes,
  type AutomationRunEventType,
  type AutomationRunEventRecord,
} from '../events/automation-run-events.types';

export class AutomationRunEventDto implements AutomationRunEventRecord {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  runId!: string;

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  sequence!: number;

  @ApiProperty({ enum: automationRunEventTypes })
  type!: AutomationRunEventType;

  @ApiProperty({ type: String, nullable: true })
  stepId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  parentStepId!: string | null;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  data!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;
}

export class AutomationRunEventPageDto {
  @ApiProperty({ type: AutomationRunEventDto, isArray: true })
  events!: AutomationRunEventDto[];

  @ApiProperty({ type: Number, nullable: true })
  nextAfter!: number | null;
}

export class AutomationRunEventStreamTokenDto {
  @ApiProperty()
  token!: string;

  @ApiProperty()
  expiresAt!: string;
}
