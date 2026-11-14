import { createTextAction } from '../shared/definition-builders'

export const logAction = createTextAction({
  uses: 'debug.log',
  category: 'Debug',
  iconKey: 'debug',
  field: 'message',
  fieldLabel: 'Message',
  fieldDescription: 'Writes the message to this step’s run result.',
  maskSummary: true,
  multiline: true
})
