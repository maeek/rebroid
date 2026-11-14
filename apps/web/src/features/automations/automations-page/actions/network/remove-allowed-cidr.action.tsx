import { createTextAction } from '../shared/definition-builders'
import { CidrActionFields } from './cidr-action-fields'

export const removeAllowedCidrAction = {
  ...createTextAction({
    uses: 'container.network.removeAllowedCidr',
    category: 'Network',
    iconKey: 'network',
    field: 'cidr',
    fieldLabel: 'CIDR'
  }),
  renderEditor: CidrActionFields
}
