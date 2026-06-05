'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  createAutomationAction,
  deleteAutomationAction,
  draftAutomationYamlAction,
  updateAutomationAction,
  validateAutomationYamlAction
} from '@/server/orchestrator/automations/actions'
import { listAutomationAiModelCatalogAction } from '@/server/orchestrator/settings/actions'
import { AutomationStepsList } from '../steps/list/automation-steps-list'
import { collectBlockKeys, collectStepKeys, firstStepKey } from '../steps/shared/automation-step-selection'
import { AutomationDetailsSection } from './automation-details-section'
import {
  AiDraftDialog,
  AutomationDeleteConfirmDialog,
  UnsavedAutomationChangesDialog
} from './automation-editor-dialogs'
import { AutomationEditorHeader } from './automation-editor-header'
import { workflowFileName } from './automation-editor-utils'
import { AutomationYamlEditorSection } from './automation-yaml-editor-section'
import {
  automationToForm,
  buildYaml,
  definitionToForm,
  defaultForm,
  formToSaveInput,
  type AutomationFormState,
  type AutomationStepForm
} from './builder-utils'
import type { AutomationEditorPageProps } from './types'
import type { Automation } from '@/server/orchestrator/automations/types'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

type EditorSnapshot = {
  form: AutomationFormState
  yamlOpen: boolean
  yamlDraft: string
}

type EditorHistoryState = {
  undo: EditorSnapshot[]
  redo: EditorSnapshot[]
}

const maxEditorHistoryEntries = 100

const cloneForm = (form: AutomationFormState): AutomationFormState =>
  typeof structuredClone === 'function'
    ? structuredClone(form)
    : (JSON.parse(JSON.stringify(form)) as AutomationFormState)

const sameSnapshot = (left: EditorSnapshot, right: EditorSnapshot) =>
  left.yamlOpen === right.yamlOpen &&
  left.yamlDraft === right.yamlDraft &&
  JSON.stringify(left.form) === JSON.stringify(right.form)

const isEditableShortcutTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLElement && target.isContentEditable) return true
  const editable = target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
  if (!editable) return false
  if (editable instanceof HTMLInputElement) {
    return editable.type !== 'checkbox' && editable.type !== 'radio'
  }
  return true
}

const unsavedAutomationMessage = 'This workflow has unsaved changes.'

export function AutomationEditorPage({ initialAutomation, initialCommands }: AutomationEditorPageProps) {
  const router = useRouter()
  const [automation, setAutomation] = useState<Automation | null>(initialAutomation ?? null)
  const [form, setForm] = useState<AutomationFormState>(() =>
    initialAutomation ? automationToForm(initialAutomation) : defaultForm()
  )
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(() => {
    const initialForm = initialAutomation ? automationToForm(initialAutomation) : defaultForm()
    return firstStepKey(initialForm.steps)
  })
  const [openBlockKeys, setOpenBlockKeys] = useState<string[]>(() => {
    const initialForm = initialAutomation ? automationToForm(initialAutomation) : defaultForm()
    return collectBlockKeys(initialForm.steps)
  })
  const [yamlStepKey, setYamlStepKey] = useState<string | null>(null)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yamlDraft, setYamlDraft] = useState('')
  const [yamlValid, setYamlValid] = useState(true)
  const [yamlError, setYamlError] = useState<string | null>(null)
  const [aiDraftOpen, setAiDraftOpen] = useState(false)
  const [aiDraftPrompt, setAiDraftPrompt] = useState('')
  const [aiModelCatalog, setAiModelCatalog] = useState<AutomationAiModelCatalogProvider[]>([])
  const [aiDraftProviderId, setAiDraftProviderId] = useState('')
  const [aiDraftModelId, setAiDraftModelId] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<EditorHistoryState>({ undo: [], redo: [] })
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const snapshotRef = useRef<EditorSnapshot | null>(null)
  const confirmedNavigationRef = useRef(false)
  const isNew = !automation
  const title = isNew ? 'New workflow' : automation.name
  const selectedAiDraftProvider =
    aiModelCatalog.find(provider => provider.id === aiDraftProviderId) ?? aiModelCatalog[0]
  const selectedAiDraftModel =
    selectedAiDraftProvider?.models.find(model => model.id === aiDraftModelId) ??
    selectedAiDraftProvider?.models.find(model => model.default) ??
    selectedAiDraftProvider?.models[0]
  const canDraftFromPrompt = Boolean(selectedAiDraftProvider && selectedAiDraftModel)
  const currentYaml = useMemo(() => {
    try {
      return buildYaml(form)
    } catch {
      return automation?.yaml ?? ''
    }
  }, [automation?.yaml, form])

  const canUndo = history.undo.length > 0
  const canRedo = history.redo.length > 0
  const hasUnsavedHistory = canUndo

  const currentSnapshot = useCallback(
    () => ({
      form: cloneForm(snapshotRef.current?.form ?? form),
      yamlOpen: snapshotRef.current?.yamlOpen ?? yamlOpen,
      yamlDraft: snapshotRef.current?.yamlDraft ?? yamlDraft
    }),
    [form, yamlDraft, yamlOpen]
  )

  const applySnapshot = useCallback((snapshot: EditorSnapshot) => {
    const nextSnapshot = {
      form: cloneForm(snapshot.form),
      yamlOpen: snapshot.yamlOpen,
      yamlDraft: snapshot.yamlDraft
    }
    snapshotRef.current = nextSnapshot
    setForm(nextSnapshot.form)
    setYamlOpen(nextSnapshot.yamlOpen)
    setYamlDraft(nextSnapshot.yamlDraft)
  }, [])

  const recordHistory = useCallback(() => {
    const snapshot = currentSnapshot()
    setHistory(current => {
      const previous = current.undo.at(-1)
      if (previous && sameSnapshot(previous, snapshot)) return current
      return {
        undo: [...current.undo, snapshot].slice(-maxEditorHistoryEntries),
        redo: []
      }
    })
  }, [currentSnapshot])

  const commitEditorChange = useCallback(
    (update: () => EditorSnapshot) => {
      recordHistory()
      applySnapshot(update())
    },
    [applySnapshot, recordHistory]
  )

  const resetEditorHistory = useCallback((snapshot: EditorSnapshot) => {
    snapshotRef.current = {
      form: cloneForm(snapshot.form),
      yamlOpen: snapshot.yamlOpen,
      yamlDraft: snapshot.yamlDraft
    }
    setHistory({ undo: [], redo: [] })
  }, [])

  const undo = useCallback(() => {
    setHistory(current => {
      const previous = current.undo.at(-1)
      if (!previous) return current
      const currentValue = currentSnapshot()
      applySnapshot(previous)
      return {
        undo: current.undo.slice(0, -1),
        redo: [currentValue, ...current.redo].slice(0, maxEditorHistoryEntries)
      }
    })
  }, [applySnapshot, currentSnapshot])

  const redo = useCallback(() => {
    setHistory(current => {
      const next = current.redo[0]
      if (!next) return current
      const currentValue = currentSnapshot()
      applySnapshot(next)
      return {
        undo: [...current.undo, currentValue].slice(-maxEditorHistoryEntries),
        redo: current.redo.slice(1)
      }
    })
  }, [applySnapshot, currentSnapshot])

  useEffect(() => {
    snapshotRef.current = {
      form: cloneForm(form),
      yamlOpen,
      yamlDraft
    }
  }, [form, yamlDraft, yamlOpen])

  const updateForm = (patch: Partial<AutomationFormState>) =>
    commitEditorChange(() => ({
      ...currentSnapshot(),
      form: { ...cloneForm(snapshotRef.current?.form ?? form), ...patch }
    }))

  useEffect(() => {
    let cancelled = false
    void listAutomationAiModelCatalogAction().then(catalog => {
      if (cancelled) return
      setAiModelCatalog(catalog)
      const provider = catalog[0]
      const model = provider?.models.find(item => item.default) ?? provider?.models[0]
      setAiDraftProviderId(provider?.id ?? '')
      setAiDraftModelId(model?.id ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const updateSteps = (steps: AutomationStepForm[]) => {
    updateForm({ steps })
  }

  useEffect(() => {
    const currentStepKeys = collectStepKeys(form.steps)
    const currentStepKeySet = new Set(currentStepKeys)
    const currentBlockKeySet = new Set(collectBlockKeys(form.steps))

    setSelectedStepKey(current => (current && currentStepKeySet.has(current) ? current : (currentStepKeys[0] ?? null)))
    setYamlStepKey(current => (current && currentStepKeySet.has(current) ? current : null))
    setOpenBlockKeys(current => current.filter(key => currentBlockKeySet.has(key)))
  }, [form.steps])

  const toggleBlock = (clientKey: string) => {
    setOpenBlockKeys(current =>
      current.includes(clientKey) ? current.filter(key => key !== clientKey) : [...current, clientKey]
    )
  }

  const openBlock = (clientKey: string) => {
    setOpenBlockKeys(current => (current.includes(clientKey) ? current : [...current, clientKey]))
  }

  const updateStepAt = (index: number, step: AutomationStepForm) => {
    updateSteps(form.steps.map((item, itemIndex) => (itemIndex === index ? step : item)))
  }

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
        variant: 'destructive'
      })
      return
    }
    setYamlOpen(false)
  }

  const toggleYamlEditor = () => {
    if (yamlOpen) openVisualEditor()
    else openYamlEditor()
  }

  const requestNavigation = useCallback(
    (href: string) => {
      if (hasUnsavedHistory) {
        setPendingNavigationHref(href)
        return
      }
      router.push(href)
    },
    [hasUnsavedHistory, router]
  )

  const confirmPendingNavigation = useCallback(() => {
    const href = pendingNavigationHref
    if (!href) return

    setPendingNavigationHref(null)
    confirmedNavigationRef.current = true
    const url = new URL(href, window.location.href)
    if (url.origin === window.location.origin) {
      router.push(`${url.pathname}${url.search}${url.hash}`)
      return
    }
    window.location.assign(url.href)
  }, [pendingNavigationHref, router])

  const showTraces = () => {
    if (automation) {
      requestNavigation(`/automations/${automation.id}/traces`)
    }
  }

  const persistAutomation = async (input: { yaml: string }) => {
    const wasNew = !automation
    const saved = automation ? await updateAutomationAction(automation.id, input) : await createAutomationAction(input)
    const nextForm = automationToForm(saved)
    setAutomation(saved)
    setForm(nextForm)
    setSelectedStepKey(firstStepKey(nextForm.steps))
    setOpenBlockKeys(collectBlockKeys(nextForm.steps))
    setYamlStepKey(null)
    if (yamlOpen) setYamlDraft(saved.yaml)
    resetEditorHistory({
      form: nextForm,
      yamlOpen,
      yamlDraft: yamlOpen ? saved.yaml : yamlDraft
    })
    toast({ title: wasNew ? 'Automation created' : 'Automation updated' })
    if (wasNew) {
      router.replace(`/automations/${saved.id}`)
    }
  }

  const save = async () => {
    if (yamlOpen && !yamlValid) return
    setBusy(true)
    try {
      await persistAutomation(yamlOpen ? { yaml: yamlDraft } : formToSaveInput(form))
    } catch (error) {
      toast({
        title: 'Could not save automation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!automation) return
    setBusy(true)
    try {
      await deleteAutomationAction(automation.id)
      toast({ title: 'Automation deleted' })
      router.replace('/automations')
    } catch (error) {
      toast({
        title: 'Could not delete automation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
      setBusy(false)
    }
  }

  const exportWorkflow = () => {
    if (yamlOpen && !yamlValid) {
      toast({
        title: 'YAML is invalid',
        description: yamlError ?? 'Fix the YAML before exporting.',
        variant: 'destructive'
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
  }

  const importWorkflow = () => {
    importInputRef.current?.click()
  }

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
      const nextForm = definitionToForm(draft.definition, automation?.id ?? form.id)
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

  const handleWorkflowImport = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const yaml = await file.text()
      const validation = await validateAutomationYamlAction(yaml)
      if (!validation.valid || !validation.definition) {
        throw new Error(validation.errors[0] ?? 'Workflow YAML is invalid.')
      }

      const nextForm = definitionToForm(validation.definition, automation?.id ?? form.id)
      commitEditorChange(() => ({
        form: nextForm,
        yamlOpen,
        yamlDraft: validation.yaml ?? yaml
      }))
      setSelectedStepKey(firstStepKey(nextForm.steps))
      setOpenBlockKeys(collectBlockKeys(nextForm.steps))
      setYamlStepKey(null)
      setYamlValid(true)
      setYamlError(null)
      toast({ title: 'Workflow imported' })
    } catch (error) {
      toast({
        title: 'Could not import workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
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
  }, [automation?.id, form.id, yamlDraft, yamlOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModZ = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z'
      if (!isModZ || event.altKey || isEditableShortcutTarget(event.target)) return

      if (event.shiftKey) {
        if (!canRedo) return
        event.preventDefault()
        redo()
        return
      }

      if (!canUndo) return
      event.preventDefault()
      undo()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canRedo, canUndo, redo, undo])

  useEffect(() => {
    if (!hasUnsavedHistory) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (confirmedNavigationRef.current) return
      event.preventDefault()
      event.returnValue = unsavedAutomationMessage
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || link.target || link.download) return
      const href = link.href
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (href === window.location.href) return

      event.preventDefault()
      event.stopPropagation()
      setPendingNavigationHref(href)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [hasUnsavedHistory])

  return (
    <ProtectedStackPageLayout mainClassName='gap-0'>
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <div className='grid gap-3'>
          <PageBreadcrumbs
            className='pt-0'
            items={[{ label: 'Automations' }, { label: 'Workflows', href: '/automations' }, { label: title }]}
          />
          <AutomationEditorHeader
            title={title}
            busy={busy}
            canDraftFromPrompt={canDraftFromPrompt}
            canDelete={Boolean(automation)}
            yamlOpen={yamlOpen}
            yamlValid={yamlValid}
            onDelete={() => setDeleteOpen(true)}
            onDraftFromPrompt={() => setAiDraftOpen(true)}
            onExport={exportWorkflow}
            onImport={importWorkflow}
            onSave={() => void save()}
            onShowTraces={showTraces}
            onToggleYaml={toggleYamlEditor}
          />
        </div>
      </section>

      <AiDraftDialog
        open={aiDraftOpen && canDraftFromPrompt}
        busy={busy}
        catalog={aiModelCatalog}
        providerId={selectedAiDraftProvider?.id ?? ''}
        modelId={selectedAiDraftModel?.id ?? ''}
        prompt={aiDraftPrompt}
        onDraft={() => void draftFromPrompt()}
        onModelChange={setAiDraftModelId}
        onOpenChange={setAiDraftOpen}
        onProviderChange={setAiDraftProviderId}
        onPromptChange={setAiDraftPrompt}
      />

      <section
        className={cn(
          'grid gap-6 px-6 pb-16 pt-2 max-sm:px-4',
          yamlOpen ? 'min-h-[calc(100dvh-9rem)] grid-rows-[auto_minmax(32rem,1fr)] 2xl:flex' : null
        )}
      >
        {yamlOpen ? (
          <>
            <AutomationDetailsSection
              form={form}
              onChange={updateForm}
              className='flex-2/5'
            />
            <AutomationYamlEditorSection
              yaml={yamlDraft}
              commands={initialCommands}
              onYamlChange={yaml =>
                commitEditorChange(() => ({
                  ...currentSnapshot(),
                  yamlDraft: yaml
                }))
              }
              onValidationChange={(valid, messages) => {
                if (!valid) {
                  setYamlValid(false)
                  setYamlError(messages[0] ?? 'Automation YAML is invalid.')
                  return
                }
                setYamlValid(true)
                setYamlError(null)
              }}
              className='flex-3/5'
            />
          </>
        ) : (
          <AutomationStepsList
            steps={form.steps}
            commands={initialCommands}
            selectedStepKey={selectedStepKey}
            openBlockKeys={openBlockKeys}
            yamlStepKey={yamlStepKey}
            onSelectStep={setSelectedStepKey}
            onToggleBlock={toggleBlock}
            onOpenBlock={openBlock}
            onYamlStepKeyChange={setYamlStepKey}
            onChange={updateSteps}
            onStepChange={updateStepAt}
            details={
              <AutomationDetailsSection
                form={form}
                onChange={updateForm}
              />
            }
            className='w-full'
          />
        )}
      </section>

      <input
        ref={importInputRef}
        type='file'
        accept='.yaml,.yml,text/yaml,application/x-yaml'
        className='hidden'
        onChange={event => void handleWorkflowImport(event.currentTarget.files?.[0] ?? null)}
      />

      <AutomationDeleteConfirmDialog
        open={deleteOpen}
        busy={busy}
        automationName={automation?.name ?? 'workflow'}
        onConfirm={() => void remove()}
        onOpenChange={setDeleteOpen}
      />

      <UnsavedAutomationChangesDialog
        open={Boolean(pendingNavigationHref)}
        onConfirm={confirmPendingNavigation}
        onOpenChange={open => {
          if (!open) setPendingNavigationHref(null)
        }}
      />
    </ProtectedStackPageLayout>
  )
}
