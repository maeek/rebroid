import { Body, Controller, Headers, Param, Patch, Post } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApplicationCommandResultDto } from '../../common/dto/application-command-result.dto';
import { UpdateNetworkPolicyDto } from '../dto/update-network-policy.dto';
import { AndroidAppsNetworkPolicyService } from '../services/android-apps-network-policy.service';
import { RequiresFeature } from '../../../feature-flags/feature-flags.guard';

@ApiTags('network-policies')
@Controller()
export class AndroidAppsNetworkController {
  constructor(private readonly network: AndroidAppsNetworkPolicyService) {}

  @Post('network-policies/reconcile')
  @RequiresFeature('feature.firewall')
  @ApiOperation({
    summary:
      'Rebuild firewall agent rules from stored applications and prune stale rules.',
  })
  reconcileNetworkPolicies() {
    return this.network.reconcileNetworkPolicies();
  }

  @Patch('apps/:id/network-policy')
  @ApiHeader({
    name: 'x-rebroid-allow-broad-egress',
    required: false,
    schema: { type: 'string', enum: ['true', 'false'], default: 'false' },
    description:
      'Internet egress permission supplied by the authenticated web service.',
  })
  @ApiOperation({
    summary: 'Update and reconcile the app container egress allowlist.',
  })
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async updateNetworkPolicy(
    @Param('id') id: string,
    @Body() dto: UpdateNetworkPolicyDto,
    @Headers('x-rebroid-allow-broad-egress') allowBroadEgress?: string,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.network.updateNetworkPolicy(
        id,
        dto,
        allowBroadEgress === 'true',
      ),
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
