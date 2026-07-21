import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { storePendingAutomationDraft } from '@/shared/model/automation-draft/pending-automation-draft'
import type { ChatTurn } from './ai-agent-chat-utils'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'
import type { AutomationYamlDraft } from '@rebroid/automation-core/yaml-draft'

export type DraftWorkflowFromRun = (input: {
  runId: string
  providerId?: string
  modelId?: string
  visionProviderId?: string
  visionModelId?: string
}) => Promise<AutomationYamlDraft>

export const useAiAgentWorkflowDraft = ({
  draftWorkflowFromRun,
  openWorkflowDraft,
  selectedModel,
  selectedProvider,
  selectedVisionModel,
  selectedVisionProvider
}: {
  draftWorkflowFromRun?: DraftWorkflowFromRun
  openWorkflowDraft?: () => void
  selectedModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedProvider: AutomationAiModelCatalogProvider | undefined
  selectedVisionModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedVisionProvider: AutomationAiModelCatalogProvider | undefined
}) => {
  const [draftingRunId, setDraftingRunId] = useState<string | null>(null)

  const saveTurnAsWorkflow = async (turn: ChatTurn) => {
    if (!turn.run || !selectedProvider || !selectedModel || !draftWorkflowFromRun || draftingRunId) return
    setDraftingRunId(turn.run.id)
    try {
      const draft = await draftWorkflowFromRun({
        runId: turn.run.id,
        providerId: selectedProvider.id,
        modelId: selectedModel.id,
        ...(selectedVisionProvider && selectedVisionModel
          ? {
              visionProviderId: selectedVisionProvider.id,
              visionModelId: selectedVisionModel.id
            }
          : {})
      })
      storePendingAutomationDraft({ yaml: draft.yaml, sourceRunId: turn.run.id })
      if (openWorkflowDraft) {
        openWorkflowDraft()
      } else {
        window.location.href = '/automations/create'
      }
    } catch (draftError) {
      toast({
        title: 'Could not draft workflow',
        description: draftError instanceof Error ? draftError.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setDraftingRunId(null)
    }
  }

  return { draftingRunId, saveTurnAsWorkflow }
}
