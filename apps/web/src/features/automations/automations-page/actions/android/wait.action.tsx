import { createNumberAction } from '../shared/definition-builders'

export const waitAction = createNumberAction({
  uses: 'android.wait',
  category: 'Device',
  iconKey: 'clock',
  field: 'durationMs',
  fieldLabel: 'Duration',
  defaultValue: 1000,
  suffix: 'ms'
})
