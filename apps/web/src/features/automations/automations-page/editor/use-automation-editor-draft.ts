'use client'

import { useEffect, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { definitionToForm } from './builder-utils'
import type { EditorSnapshot, useAutomationEditorHistory } from './use-automation-editor-history'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

type YamlValidation = { draft: string } & ({ error: string } | { error: null; definition: AutomationDefinition })

export const useAutomationEditorDraft = ({
  form,
  yamlOpen,
  yamlDraft,
  visualYaml,
  hasBrokenReferences,
  changeEditorView
}: EditorSnapshot & {
  visualYaml: string | null
  hasBrokenReferences: boolean
  changeEditorView: ReturnType<typeof useAutomationEditorHistory>['changeEditorView']
}) => {
  const [validation, setValidation] = useState<YamlValidation | null>(null)
  const currentValidation = validation?.draft === yamlDraft ? validation : null
  const yamlPending = yamlOpen && !currentValidation
  const yamlError = currentValidation?.error ?? null
  const currentYaml = yamlOpen ? yamlDraft : visualYaml
  const visualError =
    !yamlOpen && visualYaml === null ? 'Fix invalid step inputs before saving, exporting, or opening YAML.' : null
  const canSaveOrExport = yamlOpen ? currentValidation?.error === null : !hasBrokenReferences
  const yamlForSaveOrExport = canSaveOrExport ? currentYaml : null

  const openYamlEditor = () => {
    if (visualYaml === null) {
      toast({ title: 'Could not open workflow YAML', description: 'Fix invalid step inputs first.', variant: 'danger' })
      return
    }
    changeEditorView(snapshot => ({ ...snapshot, yamlDraft: visualYaml, yamlOpen: true }))
  }

  const openVisualEditor = () => {
    if (yamlDraft === visualYaml) {
      changeEditorView(snapshot => ({ ...snapshot, yamlOpen: false }))
      return
    }
    if (currentValidation?.error !== null) {
      toast({
        title: yamlPending ? 'Checking workflow YAML' : 'YAML is invalid',
        description: yamlError ?? undefined,
        variant: yamlPending ? 'neutral' : 'danger'
      })
      return
    }
    const nextForm = definitionToForm(currentValidation.definition, form.id, form.steps)
    changeEditorView(snapshot => ({ ...snapshot, form: nextForm, yamlOpen: false }))
  }

  const toggleYamlEditor = () => {
    if (yamlOpen) openVisualEditor()
    else openYamlEditor()
  }

  useEffect(() => {
    if (!yamlOpen) return

    let canceled = false
    const timeout = window.setTimeout(() => {
      void validateAutomationYamlAction(yamlDraft)
        .then(result => {
          if (canceled) return
          if (!result.valid || !result.definition) {
            setValidation({ draft: yamlDraft, error: result.errors[0] ?? 'Automation YAML is invalid.' })
            return
          }
          setValidation({ draft: yamlDraft, error: null, definition: result.definition })
        })
        .catch(error => {
          if (!canceled) setValidation({ draft: yamlDraft, error: getDisplayErrorMessage(error) })
        })
    }, 450)

    return () => {
      canceled = true
      window.clearTimeout(timeout)
    }
  }, [yamlDraft, yamlOpen])

  return { currentYaml, yamlForSaveOrExport, toggleYamlEditor, visualError, yamlError, yamlPending }
}
