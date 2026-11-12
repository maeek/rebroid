import { stringInputValue } from '../shared/input-values'
import { defaultUiTextInput, normalizeUiTextInput, UiTextActionFields } from './ui-text-action-fields'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const tapTextAction: AutomationActionDefinition = {
  uses: 'android.tapText',
  category: 'Text',
  iconKey: 'click',
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
