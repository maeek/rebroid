import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class HealthAuthDto {
  @ApiProperty({ example: true })
  sharedSecretConfigured!: boolean;
}

class ExternalAdbReadinessDto {
  @ApiProperty()
  adb!: boolean;

  @ApiProperty()
  keyStorage!: boolean;

  @ApiProperty({ enum: ["not_configured", "configured", "unavailable"] })
  usb!: "not_configured" | "configured" | "unavailable";
}

export class HealthDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: "rebroid-display-sidecar" })
  service!: string;

  @ApiProperty({ example: 8000 })
  port!: number;

  @ApiProperty({ type: HealthAuthDto })
  auth!: HealthAuthDto;

  @ApiPropertyOptional({ type: ExternalAdbReadinessDto })
  externalAdb?: ExternalAdbReadinessDto;
}
