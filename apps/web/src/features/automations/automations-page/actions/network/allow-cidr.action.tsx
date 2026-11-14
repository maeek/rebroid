import { createTextAction } from '../shared/definition-builders'
import { CidrActionFields } from './cidr-action-fields'

export const allowCidrAction = {
  ...createTextAction({
    uses: 'container.network.allowCidr',
    category: 'Network',
    iconKey: 'network',
    field: 'cidr',
    fieldLabel: 'CIDR'
  }),
  renderEditor: CidrActionFields
}
