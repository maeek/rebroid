import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const applicationViewerControlCommands = [
  'back',
  'home',
  'recents',
  'wake',
  'power',
  'volume-up',
  'volume-down',
  'mute',
  'rotate',
  'expand-notifications',
  'expand-settings',
  'collapse-panels',
] as const;

export type ApplicationViewerControlCommand =
  (typeof applicationViewerControlCommands)[number];

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
