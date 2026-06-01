import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ApplicationClipboardDto {
  @ApiProperty({ example: 'Copied text from Android' })
  text!: string;

  @ApiProperty({ example: true })
  supported!: boolean;

  @ApiProperty({ type: String, example: null, nullable: true })
  message!: string | null;
}

export class UpdateApplicationClipboardDto {
  @ApiProperty({ example: 'Text copied from the browser' })
  @IsString()
  @MaxLength(32768)
  text!: string;
}
