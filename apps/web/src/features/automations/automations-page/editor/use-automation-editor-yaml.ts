'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { buildYaml, definitionToForm, type AutomationFormState } from './builder-utils'
import type { Automation } from '@/shared/contracts/automation'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

type YamlValidation = { draft: string } & ({ error: string } | { error: null; definition: AutomationDefinition })

export const useAutomationEditorYaml = ({
  automation,
  form,
  setForm
}: {
  automation: Automation | null
  form: AutomationFormState
  setForm: (form: AutomationFormState) => void
}) => {
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yamlDraft, setYamlDraft] = useState('')
  const [validation, setValidation] = useState<YamlValidation | null>(null)
  const currentValidation = validation?.draft === yamlDraft ? validation : null
  const yamlPending = yamlOpen && !currentValidation
  const yamlError = currentValidation?.error ?? null
  const yamlValid = !yamlPending && !yamlError

  const currentYaml = useMemo(() => {
    try {
      return buildYaml(form)
    } catch {
      return automation?.yaml ?? ''
    }
  }, [automation?.yaml, form])

  const openYamlEditor = () => {
    setYamlDraft(currentYaml)
    setYamlOpen(true)
  }

  const openVisualEditor = () => {
    if (yamlDraft === currentYaml) {
      setYamlOpen(false)
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
      setForm(definitionToForm(currentValidation.definition, automation?.id ?? form.id))
      setYamlOpen(false)
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
          setForm(definitionToForm(result.definition, automation?.id ?? form.id))
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
  }, [automation?.id, form.id, setForm, yamlDraft, yamlOpen])

  return {
    currentYaml,
    setYamlDraft,
    setYamlOpen,
    toggleYamlEditor,
    yamlDraft,
    yamlError,
    yamlOpen,
    yamlPending,
    yamlValid
  }
}
