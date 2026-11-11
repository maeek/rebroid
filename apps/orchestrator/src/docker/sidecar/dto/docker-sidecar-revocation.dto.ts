import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class RevokeDockerSidecarSessionsDto {
  @ApiProperty({
    type: 'array',
    minItems: 1,
    maxItems: 256,
    items: { type: 'string', minLength: 1, maxLength: 200 },
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(256)
  @IsString({ each: true })
  @Length(1, 200, { each: true })
  @Matches(/^\S(?:.*\S)?$/, { each: true })
  ownerUserIds!: string[];
}

export class DockerSidecarSessionRevocationDto {
  @ApiProperty({ minimum: 0 })
  released!: number;
}
