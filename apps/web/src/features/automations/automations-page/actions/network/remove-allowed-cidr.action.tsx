import { createTextAction } from '../shared/definition-builders'

export const removeAllowedCidrAction = createTextAction({
  uses: 'container.network.removeAllowedCidr',
  category: 'Network',
  iconKey: 'network',
  field: 'cidr',
  fieldLabel: 'CIDR'
})
