import { FormField } from '@/components/ui/form-field'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { AiModelPicker } from '@/shared/ui/ai/ai-model-picker'
import { MAX_AD_HOC_AI_TIMEOUT_MINUTES } from './ai-agent-chat-utils'
import type { useAiAgentModelSettings } from './use-ai-agent-model-settings'

type ModelSettings = Omit<ReturnType<typeof useAiAgentModelSettings>, 'modelIsValid'>

export const AiAgentSettingsPopover = ({ settings }: { settings: ModelSettings }) => (
  <AiModelPicker
    catalog={settings.primaryCatalog}
    selectedProvider={settings.selectedProvider}
    selectedModel={settings.selectedModel}
    selectedVisionProvider={settings.selectedVisionProvider}
    selectedVisionModel={settings.selectedVisionModel}
    visionCatalog={settings.visionCatalog}
    health={settings.health}
    isCheckingHealth={settings.isCheckingHealth}
    onSelectModel={settings.selectPrimaryModel}
    onVisionProviderChange={settings.setVisionProviderId}
    onVisionModelChange={settings.setVisionModelId}
    onRecheckHealth={() => void settings.recheckHealth()}
    advanced={
      <FormField
        label='Run time limit'
        layout='vertical'
        controlId='ai-agent-timeout'
        description='Maximum time for each request.'
      >
        <NumericUnitInput
          type='number'
          id='ai-agent-timeout'
          unit='min'
          min={1}
          max={MAX_AD_HOC_AI_TIMEOUT_MINUTES}
          step={1}
          value={settings.timeoutMinutesInput}
          onBlur={() => settings.setTimeoutMinutesInput(String(settings.adHocTimeoutMinutes))}
          onChange={event => {
            const value = event.target.value
            if (/^\d{0,3}$/.test(value)) settings.setTimeoutMinutesInput(value)
          }}
        />
      </FormField>
    }
  />
)
