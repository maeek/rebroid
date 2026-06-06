'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from '@/hooks/use-toast'
import { draftAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { definitionToForm } from './builder-utils'
import { useAiDraftModelSelection } from './use-ai-draft-model-selection'
import type { EditorSnapshot } from './use-automation-editor-history'

export const useAutomationAiDraft = ({
  commitEditorChange,
  setBusy,
  setYamlError,
  setYamlValid,
  workflowId
}: {
  commitEditorChange: (update: () => EditorSnapshot) => void
  setBusy: Dispatch<SetStateAction<boolean>>
  setYamlError: Dispatch<SetStateAction<string | null>>
  setYamlValid: Dispatch<SetStateAction<boolean>>
  workflowId: string | null
}) => {
  const [aiDraftOpen, setAiDraftOpen] = useState(false)
  const [aiDraftPrompt, setAiDraftPrompt] = useState('')
  const {
    canDraftFromPrompt,
    catalog: aiModelCatalog,
    model: selectedAiDraftModel,
    provider: selectedAiDraftProvider,
    setModelId: setAiDraftModelId,
    setProviderId: setAiDraftProviderId
  } = useAiDraftModelSelection()

  const draftFromPrompt = async () => {
    const prompt = aiDraftPrompt.trim()
    if (!prompt || !selectedAiDraftProvider || !selectedAiDraftModel) return
    setBusy(true)
    try {
      const draft = await draftAutomationYamlAction({
        prompt,
        providerId: selectedAiDraftProvider.id,
        modelId: selectedAiDraftModel.id
      })
      const nextForm = definitionToForm(draft.definition, workflowId)
      commitEditorChange(() => ({
        form: nextForm,
        yamlOpen: true,
        yamlDraft: draft.yaml
      }))
      setYamlValid(true)
      setYamlError(null)
      setAiDraftOpen(false)
      setAiDraftPrompt('')
    } catch (error) {
      toast({
        title: 'Could not draft automation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
    }
  }

  return {
    aiDraftOpen,
    aiDraftPrompt,
    aiModelCatalog,
    canDraftFromPrompt,
    draftFromPrompt,
    selectedAiDraftModel,
    selectedAiDraftProvider,
    setAiDraftModelId,
    setAiDraftOpen,
    setAiDraftPrompt,
    setAiDraftProviderId
  }
}
