import { stringInputValue } from '../shared/input-values'
import { defaultUiTextInput, normalizeUiTextInput, UiTextActionFields } from './ui-text-action-fields'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const tapTextAction: AutomationActionDefinition = {
  uses: 'android.tapText',
  category: 'Text',
  iconKey: 'click',
  defaultInput: defaultUiTextInput,
  normalizeInput: normalizeUiTextInput,
  summary: input => {
    const text = stringInputValue(input, 'text')
    return text ? `“${text}” · ${input.match === 'contains' ? 'contains text' : 'exact label'}` : 'Choose text to tap'
  },
  renderEditor: ({ input, patchInput }) => (
    <UiTextActionFields
      input={input}
      patchInput={patchInput}
    />
  )
}
