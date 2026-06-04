import { createTextAction } from '../shared/definition-builders'

export const removeBlockedCidrAction = createTextAction({
  uses: 'container.network.removeBlockedCidr',
  category: 'Network',
  iconKey: 'shield',
  field: 'cidr',
  fieldLabel: 'CIDR'
})
