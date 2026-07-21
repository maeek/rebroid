import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { SidecarAuthGuard } from "./sidecar-auth.guard";
import { DisplayFeatureSnapshotDto } from "./sidecar-feature.dto";
import {
  SidecarFeatureService,
  type SidecarFeatureSnapshot,
} from "./sidecar-feature.service";

@ApiTags("features")
@UseGuards(SidecarAuthGuard)
@Controller("rebroid/display/features")
export class SidecarFeatureController {
  constructor(private readonly features: SidecarFeatureService) {}

  @Get()
  @ApiOkResponse({ type: DisplayFeatureSnapshotDto })
  getState() {
    return this.features.state();
  }

  @Put()
  @ApiBody({ type: DisplayFeatureSnapshotDto })
  @ApiOkResponse({ type: DisplayFeatureSnapshotDto })
  update(@Body() snapshot: SidecarFeatureSnapshot) {
    return this.features.apply(snapshot);
  }
}
