import { ApiProperty } from "@nestjs/swagger";

import { displayFeatureKeys } from "./sidecar-feature.service";

export class DisplayFeatureStateDto {
  @ApiProperty({ enum: displayFeatureKeys })
  key!: (typeof displayFeatureKeys)[number];

  @ApiProperty()
  effective!: boolean;
}

export class DisplayFeatureSnapshotDto {
  @ApiProperty({ minimum: 0 })
  revision!: number;

  @ApiProperty({ type: DisplayFeatureStateDto, isArray: true })
  features!: DisplayFeatureStateDto[];
}
