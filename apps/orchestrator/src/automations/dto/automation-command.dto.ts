import { ApiProperty } from '@nestjs/swagger';
import type {
  AutomationCommandEditorMetadata,
  AutomationCommandOutputMetadata,
} from '../commands/automation-command.types';

export class AutomationCommandDto {
  @ApiProperty({ example: 'android.viewerCommand' })
  uses!: string;

  @ApiProperty({ example: 'Viewer command' })
  label!: string;

  @ApiProperty({ example: 'Sends a supported viewer control command.' })
  description!: string;

  @ApiProperty({ type: String, isArray: true })
  requiredPermissions!: string[];

  @ApiProperty({ type: Object })
  inputSchema!: Record<string, unknown>;

  @ApiProperty({ type: Object, isArray: true })
  outputs!: AutomationCommandOutputMetadata[];

  @ApiProperty({ type: Object })
  editor!: AutomationCommandEditorMetadata;
}
