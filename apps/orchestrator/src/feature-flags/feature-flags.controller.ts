import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  FeatureFlagManifestDto,
  ResetFeatureFlagsDto,
  UpdateFeatureFlagsDto,
} from './dto/feature-flags.dto';
import { FeatureFlagsService } from './feature-flags.service';

@ApiTags('features')
@Controller('features')
export class FeatureFlagsController {
  constructor(private readonly features: FeatureFlagsService) {}

  @Get()
  @ApiOkResponse({ type: FeatureFlagManifestDto })
  getManifest() {
    return this.features.getManifest();
  }

  @Patch()
  @ApiOkResponse({ type: FeatureFlagManifestDto })
  update(@Body() dto: UpdateFeatureFlagsDto) {
    return this.features.update(dto);
  }

  @Post('reset')
  @ApiOkResponse({ type: FeatureFlagManifestDto })
  reset(@Body() dto: ResetFeatureFlagsDto) {
    return this.features.reset(dto.revision);
  }
}
