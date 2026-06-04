import { createTextAction } from '../shared/definition-builders'

export const logAction = createTextAction({
  uses: 'debug.log',
  category: 'Debug',
  iconKey: 'debug',
  field: 'message',
  fieldLabel: 'Message',
  multiline: true
})
