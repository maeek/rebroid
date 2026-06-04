import { createTextAction } from '../shared/definition-builders'

export const allowCidrAction = createTextAction({
  uses: 'container.network.allowCidr',
  category: 'Network',
  iconKey: 'network',
  field: 'cidr',
  fieldLabel: 'CIDR'
})
