import { createTextAction } from '../shared/definition-builders'

export const stopAction = createTextAction({
  uses: 'flow.stop',
  category: 'Flow',
  iconKey: 'x',
  field: 'reason',
  fieldLabel: 'Reason',
  multiline: true
})
