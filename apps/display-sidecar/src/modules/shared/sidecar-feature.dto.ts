import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { displayFeatureKeys } from "./sidecar-feature.service";

export class DisplayFeatureStateDto {
  @ApiProperty({ enum: displayFeatureKeys })
  key!: (typeof displayFeatureKeys)[number];

  @ApiProperty()
  effective!: boolean;
}

class ExternalTcpPolicyDto {
  @ApiProperty({ minimum: 1 })
  revision!: number;

  @ApiProperty({
    type: [String],
    description: "IPv4 CIDR ranges and individual IPv4 address:port entries.",
  })
  endpoints!: string[];
}

export class DisplayFeatureSnapshotDto {
  @ApiProperty({ minimum: 0 })
  revision!: number;

  @ApiProperty({ type: DisplayFeatureStateDto, isArray: true })
  features!: DisplayFeatureStateDto[];

  @ApiPropertyOptional({ type: ExternalTcpPolicyDto })
  tcpPolicy?: ExternalTcpPolicyDto;
}
