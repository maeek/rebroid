import { ApiProperty } from "@nestjs/swagger";

export class DisplayFeatureStateDto {
  @ApiProperty({ enum: ["feature.display-virtual"] })
  key!: "feature.display-virtual";

  @ApiProperty()
  effective!: boolean;
}

export class DisplayFeatureSnapshotDto {
  @ApiProperty({ minimum: 0 })
  revision!: number;

  @ApiProperty({ type: DisplayFeatureStateDto, isArray: true })
  features!: DisplayFeatureStateDto[];
}
