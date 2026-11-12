import { stringInputValue } from '../shared/input-values'
import { defaultUiTextInput, normalizeUiTextInput, UiTextActionFields } from './ui-text-action-fields'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const waitForTextAction: AutomationActionDefinition = {
  uses: 'android.waitForText',
  category: 'Text',
  iconKey: 'text',
  defaultInput: defaultUiTextInput,
  normalizeInput: normalizeUiTextInput,
  summary: input => stringInputValue(input, 'text') || 'text:',
  renderEditor: ({ input, patchInput }) => (
    <UiTextActionFields
      input={input}
      patchInput={patchInput}
    />
  )
}
