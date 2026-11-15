import {
  OptionalNetworkPolicyAllowCidrs,
  OptionalNetworkPolicyEnabled,
} from '../../../network-policy/network-policy-validation';

export class UpdateNetworkPolicyDto {
  @OptionalNetworkPolicyEnabled({ example: true })
  networkPolicyEnabled?: boolean;

  @OptionalNetworkPolicyAllowCidrs()
  networkPolicyAllowCidrs?: string[];
}
