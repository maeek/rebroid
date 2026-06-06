'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  createAutomationAction,
  deleteAutomationAction,
  updateAutomationAction,
  validateAutomationYamlAction
} from '@/server/orchestrator/automations/automation-management-actions'
import { AutomationStepsList } from '../steps/list/automation-steps-list'
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
  definitionToForm,
  defaultForm,
  formToSaveInput,
  type AutomationFormState,
  type AutomationStepForm
} from './builder-utils'
import { useAutomationAiDraft } from './use-automation-ai-draft'
import { cloneAutomationForm, useAutomationEditorHistory } from './use-automation-editor-history'
import { useAutomationEditorSelection } from './use-automation-editor-selection'
import { useAutomationEditorYaml } from './use-automation-editor-yaml'
import { useUnsavedAutomationNavigation } from './use-unsaved-automation-navigation'
import type { AutomationEditorPageProps } from './types'
import type { Automation } from '@/server/orchestrator/automations/types'

export function AutomationEditorPage({ initialAutomation, initialCommands }: AutomationEditorPageProps) {
  const router = useRouter()
  const [automation, setAutomation] = useState<Automation | null>(initialAutomation ?? null)
  const [form, setForm] = useState<AutomationFormState>(() =>
    initialAutomation ? automationToForm(initialAutomation) : defaultForm()
  )
  const {
    openBlock,
    openBlockKeys,
    resetSelectionForSteps,
    selectedStepKey,
    setSelectedStepKey,
    setYamlStepKey,
    toggleBlock,
    yamlStepKey
  } = useAutomationEditorSelection(form.steps)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const isNew = !automation
  const title = isNew ? 'New workflow' : automation.name
  const {
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
  } = useAutomationEditorYaml({ automation, form, setForm })
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
  const {
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
  } = useAutomationAiDraft({
    commitEditorChange,
    setBusy,
    setYamlError,
    setYamlValid,
    workflowId: automation?.id ?? form.id
  })

  const updateForm = (patch: Partial<AutomationFormState>) =>
    commitEditorChange(() => ({
      ...currentSnapshot(),
      form: { ...cloneAutomationForm(currentSnapshot().form), ...patch }
    }))

  const updateSteps = (steps: AutomationStepForm[]) => {
    updateForm({ steps })
  }

  const updateStepAt = (index: number, step: AutomationStepForm) => {
    updateSteps(form.steps.map((item, itemIndex) => (itemIndex === index ? step : item)))
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
    resetSelectionForSteps(nextForm.steps)
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
      resetSelectionForSteps(nextForm.steps)
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
