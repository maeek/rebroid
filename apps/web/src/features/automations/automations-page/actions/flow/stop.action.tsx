import { createTextAction } from '../shared/definition-builders'

export const stopAction = createTextAction({
  uses: 'flow.stop',
  category: 'Flow',
  iconKey: 'x',
  field: 'reason',
  fieldLabel: 'Reason (optional)',
  fieldDescription: 'Ends the run successfully and skips subsequent steps.',
  multiline: true
})
