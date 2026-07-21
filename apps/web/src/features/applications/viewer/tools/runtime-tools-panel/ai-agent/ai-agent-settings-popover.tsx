import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AiModelPicker } from '@/shared/ui/ai/ai-model-picker'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

export const AiAgentSettingsPopover = ({
  adHocTimeoutMinutes,
  catalog,
  health,
  isCheckingHealth,
  onRecheckHealth,
  selectedModel,
  selectedProvider,
  selectedVisionModel,
  selectedVisionProvider,
  setModelId,
  setProviderId,
  setVisionModelId,
  setVisionProviderId,
  setTimeoutMinutesInput,
  timeoutMinutesInput,
  visionCatalog
}: {
  adHocTimeoutMinutes: number
  catalog: AutomationAiModelCatalogProvider[]
  health: AutomationAiProviderHealth | null
  isCheckingHealth: boolean
  onRecheckHealth: () => void
  selectedModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedProvider: AutomationAiModelCatalogProvider | undefined
  selectedVisionModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedVisionProvider: AutomationAiModelCatalogProvider | undefined
  setModelId: (modelId: string) => void
  setProviderId: (providerId: string) => void
  setVisionModelId: (modelId: string) => void
  setVisionProviderId: (providerId: string) => void
  setTimeoutMinutesInput: (value: string) => void
  timeoutMinutesInput: string
  visionCatalog: AutomationAiModelCatalogProvider[]
}) => (
  <AiModelPicker
    catalog={catalog}
    selectedProvider={selectedProvider}
    selectedModel={selectedModel}
    selectedVisionProvider={selectedVisionProvider}
    selectedVisionModel={selectedVisionModel}
    visionCatalog={visionCatalog}
    health={health}
    isCheckingHealth={isCheckingHealth}
    onProviderChange={setProviderId}
    onModelChange={setModelId}
    onVisionProviderChange={setVisionProviderId}
    onVisionModelChange={setVisionModelId}
    onRecheckHealth={onRecheckHealth}
    advanced={
      <>
        <Label>Timeout</Label>
        <Input
          type='number'
          min={1}
          max={120}
          step={1}
          value={timeoutMinutesInput}
          onBlur={() => setTimeoutMinutesInput(String(adHocTimeoutMinutes))}
          onChange={event => {
            const value = event.target.value
            if (/^\d{0,3}$/.test(value)) setTimeoutMinutesInput(value)
          }}
        />
      </>
    }
  />
)
