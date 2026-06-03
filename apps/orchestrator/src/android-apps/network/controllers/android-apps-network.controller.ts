import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationCommandResultDto } from '../../common/dto/application-command-result.dto';
import { UpdateNetworkPolicyDto } from '../dto/update-network-policy.dto';
import { AndroidAppsNetworkPolicyService } from '../services/android-apps-network-policy.service';

@ApiTags('network-policies')
@Controller()
export class AndroidAppsNetworkController {
  constructor(private readonly network: AndroidAppsNetworkPolicyService) {}

  @Post('network-policies/reconcile')
  @ApiOperation({
    summary:
      'Rebuild firewall agent rules from stored applications and prune stale rules.',
  })
  reconcileNetworkPolicies() {
    return this.network.reconcileNetworkPolicies();
  }

  @Patch('apps/:id/network-policy')
  @ApiOperation({
    summary: 'Update and reconcile the app container egress allowlist.',
  })
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async updateNetworkPolicy(
    @Param('id') id: string,
    @Body() dto: UpdateNetworkPolicyDto,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.network.updateNetworkPolicy(id, dto),
    );
  }

  @Post('apps/:id/network-policy/apply')
  @ApiOperation({
    summary:
      'Re-apply the stored network policy without restarting the container.',
  })
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async applyNetworkPolicy(@Param('id') id: string) {
    return ApplicationCommandResultDto.fromEntity(
      await this.network.applyNetworkPolicy(id),
    );
  }
}
