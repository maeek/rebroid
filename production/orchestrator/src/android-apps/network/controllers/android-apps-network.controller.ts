import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AndroidApplicationResponseDto } from '../../common/dto/android-application-response.dto';
import { toAndroidApplicationResponse } from '../../common/utils/android-apps-controller-response.utils';
import { UpdateNetworkPolicyDto } from '../dto/update-network-policy.dto';
import { AndroidAppsNetworkPolicyService } from '../services/android-apps-network-policy.service';

@ApiTags('android-applications')
@Controller('android-applications')
export class AndroidAppsNetworkController {
  constructor(private readonly network: AndroidAppsNetworkPolicyService) {}

  @Patch(':id/network-policy')
  @ApiOperation({
    summary: 'Update and reconcile the app container egress allowlist.',
  })
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  updateNetworkPolicy(
    @Param('id') id: string,
    @Body() dto: UpdateNetworkPolicyDto,
  ) {
    return toAndroidApplicationResponse(
      this.network.updateNetworkPolicy(id, dto),
    );
  }

  @Post(':id/network-policy/apply')
  @ApiOperation({
    summary:
      'Re-apply the stored network policy without restarting the container.',
  })
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  applyNetworkPolicy(@Param('id') id: string) {
    return toAndroidApplicationResponse(this.network.applyNetworkPolicy(id));
  }
}
