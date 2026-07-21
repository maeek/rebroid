import { useEffect, useMemo, useRef, useState } from 'react'
import { conversationBeforeTurn, terminalRunStatuses, type ChatTurn } from './ai-agent-chat-utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'
import type { AiPromptSuggestion, SuggestAdHocAiPromptsInput } from '@/shared/contracts/automation'

export type GeneratePromptSuggestions = (
  input: SuggestAdHocAiPromptsInput
) => Promise<{ suggestions: AiPromptSuggestion[] }>

export const useAiAgentPromptSuggestions = ({
  activeTurn,
  app,
  contextualSuggestionsEnabled,
  fallbackSuggestions,
  generatePromptSuggestions,
  selectedModel,
  selectedProvider,
  turns
}: {
  activeTurn: ChatTurn | null
  app: AppDefinition
  contextualSuggestionsEnabled: boolean
  fallbackSuggestions: AiPromptSuggestion[]
  generatePromptSuggestions?: GeneratePromptSuggestions
  selectedModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedProvider: AutomationAiModelCatalogProvider | undefined
  turns: ChatTurn[]
}) => {
  const [suggestions, setSuggestions] = useState<AiPromptSuggestion[]>(fallbackSuggestions)
  const turnsRef = useRef<ChatTurn[]>([])

  useEffect(() => {
    turnsRef.current = turns
  }, [turns])

  const terminalTurnsKey = useMemo(
    () =>
      turns
        .filter(turn => !turn.run || terminalRunStatuses.has(turn.run.status))
        .map(turn => `${turn.id}:${turn.status}:${turn.events.at(-1)?.sequence ?? 0}`)
        .join('|'),
    [turns]
  )

  useEffect(() => {
    if (!contextualSuggestionsEnabled || !generatePromptSuggestions || !selectedProvider || !selectedModel) {
      setSuggestions(fallbackSuggestions)
      return
    }
    if (activeTurn) return

    let cancelled = false
    const currentTurns = turnsRef.current
    const recentEvents = currentTurns
      .flatMap(turn => turn.events)
      .filter(event => event.message.trim().length > 0)
      .slice(-20)
      .map(event => ({ type: event.type, message: event.message }))

    void generatePromptSuggestions({
      targetApplicationId: app.id,
      appName: app.name,
      profileMode: app.profileMode,
      profileName: app.profileName,
      conversation: conversationBeforeTurn('__suggestions__', currentTurns),
      recentEvents,
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
    activeTurn,
    app.id,
    app.name,
    app.profileMode,
    app.profileName,
    contextualSuggestionsEnabled,
    fallbackSuggestions,
    generatePromptSuggestions,
    selectedModel,
    selectedProvider,
    terminalTurnsKey
  ])

  return suggestions
}
