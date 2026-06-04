import { createTextAction } from '../shared/definition-builders'

export const blockCidrAction = createTextAction({
  uses: 'container.network.blockCidr',
  category: 'Network',
  iconKey: 'shield',
  field: 'cidr',
  fieldLabel: 'CIDR'
})
