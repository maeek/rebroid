'use client'

import { useEffect, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { definitionToForm } from './builder-utils'
import type { EditorSnapshot, useAutomationEditorHistory } from './use-automation-editor-history'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

type YamlValidation = { draft: string } & ({ error: string } | { error: null; definition: AutomationDefinition })

export const useAutomationEditorYaml = ({
  form,
  yamlOpen,
  yamlDraft,
  currentYaml,
  changeEditorView
}: EditorSnapshot & {
  currentYaml: string | null
  changeEditorView: ReturnType<typeof useAutomationEditorHistory>['changeEditorView']
}) => {
  const [validation, setValidation] = useState<YamlValidation | null>(null)
  const currentValidation = validation?.draft === yamlDraft ? validation : null
  const yamlPending = yamlOpen && !currentValidation
  const yamlError = currentValidation?.error ?? null
  const yamlValid = !yamlPending && !yamlError

  const openYamlEditor = () => {
    if (currentYaml === null) {
      toast({ title: 'Could not open workflow YAML', description: 'Fix invalid step inputs first.', variant: 'danger' })
      return
    }
    changeEditorView(snapshot => ({ ...snapshot, yamlDraft: currentYaml, yamlOpen: true }))
  }

  const openVisualEditor = () => {
    if (yamlDraft === currentYaml) {
      changeEditorView(snapshot => ({ ...snapshot, yamlOpen: false }))
      return
    }
    if (!yamlValid) {
      toast({
        title: yamlPending ? 'Checking workflow YAML' : 'YAML is invalid',
        description: yamlError ?? undefined,
        variant: yamlPending ? 'neutral' : 'danger'
      })
      return
    }
    if (currentValidation?.error === null) {
      const nextForm = definitionToForm(currentValidation.definition, form.id, form.steps)
      changeEditorView(snapshot => ({ ...snapshot, form: nextForm, yamlOpen: false }))
    }
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

  return { toggleYamlEditor, yamlError, yamlPending, yamlValid }
}
