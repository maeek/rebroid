import { useEffect, useState } from 'react'
import type { AiAgentTarget } from './ai-agent-target'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'
import type { AiPromptSuggestion, SuggestAdHocAiPromptsInput } from '@/shared/contracts/automation'

export type GeneratePromptSuggestions = (
  input: SuggestAdHocAiPromptsInput
) => Promise<{ suggestions: AiPromptSuggestion[] }>

export const useAiAgentPromptSuggestions = ({
  visible,
  app,
  contextualSuggestionsEnabled,
  fallbackSuggestions,
  generatePromptSuggestions,
  selectedModel,
  selectedProvider
}: {
  visible: boolean
  app: AiAgentTarget
  contextualSuggestionsEnabled: boolean
  fallbackSuggestions: AiPromptSuggestion[]
  generatePromptSuggestions?: GeneratePromptSuggestions
  selectedModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedProvider: AutomationAiModelCatalogProvider | undefined
}) => {
  const [suggestions, setSuggestions] = useState<AiPromptSuggestion[]>(fallbackSuggestions)
  useEffect(() => {
    if (!contextualSuggestionsEnabled || !generatePromptSuggestions || !selectedProvider || !selectedModel) {
      setSuggestions(fallbackSuggestions)
      return
    }
    if (!visible) return

    let cancelled = false
    void generatePromptSuggestions({
      targetDeviceId: app.id,
      ...(app.attachmentId && { attachmentId: app.attachmentId }),
      appName: app.name,
      profileMode: app.profileMode,
      profileName: app.profileName,
      conversation: [],
      recentEvents: [],
      providerId: selectedProvider.id,
      modelId: selectedModel.id
    })
      .then(result => {
        if (cancelled || result.suggestions.length === 0) return
        setSuggestions(result.suggestions)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [
    visible,
    app.id,
    app.attachmentId,
    app.name,
    app.profileMode,
    app.profileName,
    contextualSuggestionsEnabled,
    fallbackSuggestions,
    generatePromptSuggestions,
    selectedModel,
    selectedProvider
  ])

  return suggestions
}
