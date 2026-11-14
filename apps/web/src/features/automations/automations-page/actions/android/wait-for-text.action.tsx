import { numberInputValue, stringInputValue } from '../shared/input-values'
import { defaultUiTextInput, normalizeUiTextInput, UiTextActionFields } from './ui-text-action-fields'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const waitForTextAction: AutomationActionDefinition = {
  uses: 'android.waitForText',
  category: 'Text',
  iconKey: 'text',
  defaultInput: defaultUiTextInput,
  normalizeInput: normalizeUiTextInput,
  summary: input => {
    const text = stringInputValue(input, 'text')
    return text
      ? `“${text}” · up to ${numberInputValue(input, 'timeoutMs', 10000) / 1000} s`
      : 'Choose text to wait for'
  },
  renderEditor: ({ input, patchInput }) => (
    <UiTextActionFields
      input={input}
      patchInput={patchInput}
    />
  )
}
