'use client'

import { useCallback, type RefObject } from 'react'
import { toast } from '@/hooks/use-toast'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { workflowFileName } from './automation-editor-utils'
import { definitionToForm, type AutomationFormState, type AutomationStepForm } from './builder-utils'
import type { EditorSnapshot } from './use-automation-editor-history'

export const useAutomationWorkflowFiles = ({
  automationId,
  commitEditorChange,
  currentYaml,
  form,
  importInputRef,
  resetSelectionForSteps,
  setBusy,
  setYamlError,
  setYamlValid,
  title,
  yamlDraft,
  yamlError,
  yamlOpen,
  yamlValid
}: {
  automationId?: string
  commitEditorChange: (update: () => EditorSnapshot) => void
  currentYaml: string
  form: AutomationFormState
  importInputRef: RefObject<HTMLInputElement | null>
  resetSelectionForSteps: (steps: AutomationStepForm[]) => void
  setBusy: (busy: boolean) => void
  setYamlError: (error: string | null) => void
  setYamlValid: (valid: boolean) => void
  title: string
  yamlDraft: string
  yamlError: string | null
  yamlOpen: boolean
  yamlValid: boolean
}) => {
  const exportWorkflow = useCallback(() => {
    if (yamlOpen && !yamlValid) {
      toast({
        title: 'YAML is invalid',
        description: yamlError ?? 'Fix the YAML before exporting.',
        variant: 'danger'
      })
      return
    }

    const yaml = yamlOpen ? yamlDraft : currentYaml
    const blob = new Blob([`${yaml.trimEnd()}\n`], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflowFileName(form.name || title)}.yaml`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [currentYaml, form.name, title, yamlDraft, yamlError, yamlOpen, yamlValid])

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

        const nextForm = definitionToForm(validation.definition, automationId ?? form.id)
        commitEditorChange(() => ({
          form: nextForm,
          yamlOpen,
          yamlDraft: validation.yaml ?? yaml
        }))
        resetSelectionForSteps(nextForm.steps)
        setYamlValid(true)
        setYamlError(null)
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
    [
      automationId,
      commitEditorChange,
      form.id,
      importInputRef,
      resetSelectionForSteps,
      setBusy,
      setYamlError,
      setYamlValid,
      yamlOpen
    ]
  )

  return {
    exportWorkflow,
    handleWorkflowImport,
    importWorkflow
  }
}
