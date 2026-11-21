'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { sendBff } from '@/lib/http/bff'
import { definitionToForm } from './builder-utils'
import type { EditorSnapshot, useAutomationEditorHistory } from './use-automation-editor-history'
import type { AutomationValidation } from '@/shared/contracts/automation'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

type YamlValidation = { draft: string } & (
  { error: string; retryable?: boolean } | { error: null; definition: AutomationDefinition }
)

export const useAutomationEditorDraft = ({
  form,
  yamlOpen,
  yamlDraft,
  visualYaml,
  hasBrokenReferences,
  saving = false,
  validateImmediately = false,
  changeEditorView
}: EditorSnapshot & {
  visualYaml: string | null
  hasBrokenReferences: boolean
  saving?: boolean
  validateImmediately?: boolean
  changeEditorView: ReturnType<typeof useAutomationEditorHistory>['changeEditorView']
}) => {
  const [validation, setValidation] = useState<YamlValidation | null>(null)
  const [errorFocusRequest, setErrorFocusRequest] = useState(0)
  const [switchingToVisual, setSwitchingToVisual] = useState(false)
  const switching = useRef(false)
  const latestCheck = useRef<{ draft: string; result: Promise<YamlValidation> } | null>(null)
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

  const checkYaml = useCallback((draft: string) => {
    if (latestCheck.current?.draft === draft) return latestCheck.current.result

    const pending = sendBff<AutomationValidation>('/api/bff/automations/validate-yaml', { yaml: draft })
      .then((result): YamlValidation => {
        if (result.valid && result.definition) return { draft, error: null, definition: result.definition }
        return { draft, error: result.errors[0] ?? 'Automation YAML is invalid.' }
      })
      .catch((error): YamlValidation => ({ draft, error: getDisplayErrorMessage(error), retryable: true }))
      .then(result => {
        if (latestCheck.current?.result === check.result) {
          if (result.error !== null && result.retryable) latestCheck.current = null
          setValidation(result)
        }
        return result
      })
    const check = { draft, result: pending }
    latestCheck.current = check
    return pending
  }, [])

  const validateYamlNow = async () => {
    const checked =
      currentValidation && (currentValidation.error === null || !currentValidation.retryable)
        ? currentValidation
        : await checkYaml(yamlDraft)
    if (checked.error !== null) setErrorFocusRequest(request => request + 1)
    return checked
  }

  const openVisualEditor = async () => {
    if (switching.current) return
    if (yamlDraft === visualYaml) {
      changeEditorView(snapshot => ({ ...snapshot, yamlOpen: false }))
      return
    }
    switching.current = true
    setSwitchingToVisual(true)
    try {
      const checked = await validateYamlNow()
      if (checked.error !== null) return
      const nextForm = definitionToForm(checked.definition, form.id, form.steps)
      changeEditorView(snapshot => {
        if (!snapshot.yamlOpen || snapshot.yamlDraft !== checked.draft) return snapshot
        return { ...snapshot, form: nextForm, yamlOpen: false }
      })
    } finally {
      switching.current = false
      setSwitchingToVisual(false)
    }
  }

  const toggleYamlEditor = () => {
    if (yamlOpen) void openVisualEditor()
    else openYamlEditor()
  }

  useEffect(() => {
    if (!yamlOpen || currentValidation || saving) return
    if (validateImmediately) {
      void checkYaml(yamlDraft)
      return
    }
    const timeout = window.setTimeout(() => void checkYaml(yamlDraft), 450)
    return () => window.clearTimeout(timeout)
  }, [checkYaml, currentValidation, saving, validateImmediately, yamlDraft, yamlOpen])

  return {
    canSave: yamlOpen || yamlForSaveOrExport !== null,
    currentYaml,
    errorFocusRequest,
    switchingToVisual,
    toggleYamlEditor,
    reportSaveError: (error: string) => {
      latestCheck.current = null
      setValidation({ draft: yamlDraft, error })
      setErrorFocusRequest(request => request + 1)
    },
    retryYamlValidation: () => {
      if (!currentValidation?.error) return
      latestCheck.current = null
      setValidation(null)
      void checkYaml(yamlDraft)
    },
    validatedDefinition: currentValidation?.error === null ? currentValidation.definition : null,
    visualError,
    yamlError,
    yamlForSaveOrExport,
    yamlPending
  }
}
