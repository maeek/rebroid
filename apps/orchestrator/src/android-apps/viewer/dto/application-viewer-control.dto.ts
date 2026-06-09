import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  viewerCommands,
  type ViewerCommand,
} from '@rebroid/application-core/viewer-control';

export type ApplicationViewerControlCommand = ViewerCommand;
export const applicationViewerControlCommands = viewerCommands;

export class ApplicationViewerControlDto {
  @ApiProperty({
    enum: applicationViewerControlCommands,
    example: 'home',
  })
  @IsIn(applicationViewerControlCommands)
  command!: ApplicationViewerControlCommand;
}

export class ApplicationViewerControlResponseDto {
  @ApiProperty({
    enum: applicationViewerControlCommands,
    example: 'home',
  })
  command!: ApplicationViewerControlCommand;

  @ApiProperty({ example: true })
  executed!: boolean;

  @ApiProperty({ example: 'Viewer control command executed.' })
  message!: string;
}
