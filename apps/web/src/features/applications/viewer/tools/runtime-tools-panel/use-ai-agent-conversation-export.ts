import { recommendAiModelForAutomation } from '@rebroid/ai-core/provider'
import { toast } from '@/hooks/use-toast'
import type { ChatTurn } from './ai-agent-chat-utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

const safeExportName = (app: AppDefinition) =>
  app.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || app.id

export const useAiAgentConversationExport = ({
  adHocTimeoutMs,
  app,
  selectedModel,
  selectedProvider,
  selectedVisionModel,
  selectedVisionProvider,
  turns
}: {
  adHocTimeoutMs: number
  app: AppDefinition
  selectedModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedProvider: AutomationAiModelCatalogProvider | undefined
  selectedVisionModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedVisionProvider: AutomationAiModelCatalogProvider | undefined
  turns: ChatTurn[]
}) => {
  const exportConversation = () => {
    if (turns.length === 0) return
    try {
      const exportedAt = new Date().toISOString()
      const payload = {
        exportedAt,
        app: {
          id: app.id,
          name: app.name,
          profileMode: app.profileMode,
          profileName: app.profileName,
          status: app.status,
          lifecycleStage: app.lifecycleStage
        },
        planner: selectedProvider && selectedModel ? { provider: selectedProvider, model: selectedModel } : null,
        vision:
          selectedVisionProvider && selectedVisionModel
            ? { provider: selectedVisionProvider, model: selectedVisionModel }
            : null,
        modelRecommendations: {
          planner: selectedModel ? recommendAiModelForAutomation(selectedModel) : null,
          vision: selectedVisionModel ? recommendAiModelForAutomation(selectedVisionModel) : null
        },
        sharedMultimodalMode: Boolean(
          selectedProvider &&
          selectedModel &&
          selectedVisionProvider &&
          selectedVisionModel &&
          selectedProvider.id === selectedVisionProvider.id &&
          selectedModel.id === selectedVisionModel.id &&
          selectedModel.roles.includes('vision')
        ),
        timeoutMs: adHocTimeoutMs,
        turns
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `rebroid-ai-conversation-${safeExportName(app)}-${exportedAt.replace(/[:.]/g, '-')}.json`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      toast({
        title: 'Could not export conversation',
        description: exportError instanceof Error ? exportError.message : 'Unknown error',
        variant: 'destructive'
      })
    }
  }

  return exportConversation
}
