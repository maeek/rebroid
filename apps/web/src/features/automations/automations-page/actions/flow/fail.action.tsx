import { createTextAction } from '../shared/definition-builders'

export const failAction = createTextAction({
  uses: 'flow.fail',
  category: 'Flow',
  iconKey: 'alert',
  field: 'reason',
  fieldLabel: 'Failure message',
  fieldDescription: 'Ends the run and shows this message in its results.',
  multiline: true
})
