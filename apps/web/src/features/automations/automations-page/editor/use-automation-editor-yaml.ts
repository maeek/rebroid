'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { buildYaml, definitionToForm, type AutomationFormState } from './builder-utils'
import type { Automation } from '@/shared/contracts/automation'

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
  const [yamlValid, setYamlValid] = useState(true)
  const [yamlError, setYamlError] = useState<string | null>(null)

  const currentYaml = useMemo(() => {
    try {
      return buildYaml(form)
    } catch {
      return automation?.yaml ?? ''
    }
  }, [automation?.yaml, form])

  const openYamlEditor = () => {
    setYamlDraft(currentYaml)
    setYamlValid(true)
    setYamlError(null)
    setYamlOpen(true)
  }

  const openVisualEditor = () => {
    if (!yamlValid) {
      toast({
        title: 'YAML is invalid',
        description: yamlError ?? 'Fix the YAML before switching back to the visual editor.',
        variant: 'danger'
      })
      return
    }
    setYamlOpen(false)
  }

  const toggleYamlEditor = () => {
    if (yamlOpen) openVisualEditor()
    else openYamlEditor()
  }

  useEffect(() => {
    if (!yamlOpen) return

    let canceled = false
    const timeout = window.setTimeout(() => {
      void validateAutomationYamlAction(yamlDraft).then(validation => {
        if (canceled) return
        if (!validation.valid || !validation.definition) {
          setYamlValid(false)
          setYamlError(validation.errors[0] ?? 'Automation YAML is invalid.')
          return
        }

        setYamlValid(true)
        setYamlError(null)
        setForm(definitionToForm(validation.definition, automation?.id ?? form.id))
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
    setYamlError,
    setYamlOpen,
    setYamlValid,
    toggleYamlEditor,
    yamlDraft,
    yamlError,
    yamlOpen,
    yamlValid
  }
}
