'use client'

import { useCallback, type RefObject } from 'react'
import { toast } from '@/hooks/use-toast'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { workflowFileName } from './automation-editor-utils'
import { definitionToForm, type AutomationStepForm } from './builder-utils'
import type { EditorSnapshot } from './use-automation-editor-history'

export const downloadWorkflowYaml = (name: string, yaml: string) => {
  const url = URL.createObjectURL(new Blob([yaml], { type: 'text/yaml;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${workflowFileName(name)}.yaml`
  anchor.click()
  URL.revokeObjectURL(url)
}

export const useAutomationWorkflowFiles = ({
  commitEditorChange,
  workflowId,
  importInputRef,
  resetSelectionForSteps,
  setBusy,
  yamlOpen
}: {
  commitEditorChange: (update: () => EditorSnapshot) => void
  workflowId: string | null
  importInputRef: RefObject<HTMLInputElement | null>
  resetSelectionForSteps: (steps: AutomationStepForm[]) => void
  setBusy: (busy: boolean) => void
  yamlOpen: boolean
}) => {
  const importWorkflow = useCallback(() => {
    importInputRef.current?.click()
  }, [importInputRef])

  const handleWorkflowImport = useCallback(
    async (file: File | null) => {
      if (!file) return
      setBusy(true)
      try {
        const yaml = await file.text()
        const validation = await validateAutomationYamlAction(yaml)
        if (!validation.valid || !validation.definition) {
          throw new Error(validation.errors[0] ?? 'Workflow YAML is invalid.')
        }

        const nextForm = definitionToForm(validation.definition, workflowId)
        commitEditorChange(() => ({
          form: nextForm,
          yamlOpen,
          yamlDraft: validation.yaml ?? yaml
        }))
        resetSelectionForSteps(nextForm.steps)
        toast({ title: 'Workflow imported' })
      } catch (error) {
        toast({
          title: 'Could not import workflow',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        })
      } finally {
        setBusy(false)
        if (importInputRef.current) importInputRef.current.value = ''
      }
    },
    [commitEditorChange, workflowId, importInputRef, resetSelectionForSteps, setBusy, yamlOpen]
  )

  return {
    handleWorkflowImport,
    importWorkflow
  }
}
