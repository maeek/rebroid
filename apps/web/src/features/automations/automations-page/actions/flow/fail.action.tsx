import { createTextAction } from '../shared/definition-builders'

export const failAction = createTextAction({
  uses: 'flow.fail',
  category: 'Flow',
  iconKey: 'alert',
  field: 'reason',
  fieldLabel: 'Reason',
  multiline: true
})
