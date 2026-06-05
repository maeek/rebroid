'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useAiDraftModelSelection } from './use-ai-draft-model-selection'
import { cloneAutomationForm, useAutomationEditorHistory } from './use-automation-editor-history'
import { useUnsavedAutomationNavigation } from './use-unsaved-automation-navigation'
import type { AutomationEditorPageProps } from './types'
import type { Automation } from '@/server/orchestrator/automations/types'

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
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const isNew = !automation
  const title = isNew ? 'New workflow' : automation.name
  const {
    canDraftFromPrompt,
    catalog: aiModelCatalog,
    model: selectedAiDraftModel,
    provider: selectedAiDraftProvider,
    setModelId: setAiDraftModelId,
    setProviderId: setAiDraftProviderId
  } = useAiDraftModelSelection()
  const currentYaml = useMemo(() => {
    try {
      return buildYaml(form)
    } catch {
      return automation?.yaml ?? ''
    }
  }, [automation?.yaml, form])
  const { commitEditorChange, currentSnapshot, hasUnsavedHistory, resetEditorHistory } = useAutomationEditorHistory({
    form,
    yamlOpen,
    yamlDraft,
    setForm,
    setYamlOpen,
    setYamlDraft
  })
  const { confirmPendingNavigation, pendingNavigationHref, requestNavigation, setPendingNavigationHref } =
    useUnsavedAutomationNavigation({
      hasUnsavedChanges: hasUnsavedHistory,
      push: router.push
    })

  const updateForm = (patch: Partial<AutomationFormState>) =>
    commitEditorChange(() => ({
      ...currentSnapshot(),
      form: { ...cloneAutomationForm(currentSnapshot().form), ...patch }
    }))

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
