import { emptyRequest, jsonRequest } from '../request'
import type { ApplicationCommandResult, UpdateNetworkPolicyInput } from '@/shared/contracts/application'

export const orchestratorAppNetworkPolicyClient = {
  updateNetworkPolicy(id: string, input: UpdateNetworkPolicyInput, canUseInternet: boolean) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}/network-policy`, 'PATCH', input, {
      headers: { 'x-rebroid-allow-broad-egress': String(canUseInternet) }
    })
  },

  applyNetworkPolicy(id: string) {
    return emptyRequest<ApplicationCommandResult>(`/apps/${id}/network-policy/apply`, { method: 'POST' })
  },

  reconcileNetworkPolicies() {
    return emptyRequest<{ reconciled: number }>('/network-policies/reconcile', { method: 'POST' })
  }
}
