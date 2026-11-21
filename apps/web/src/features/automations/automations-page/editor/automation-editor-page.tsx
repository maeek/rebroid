'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { FieldChangesProvider } from '@/components/ui/field-changes'
import { Notice } from '@/components/ui/notice'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { toast } from '@/hooks/use-toast'
import { useUnsavedNavigation } from '@/hooks/use-unsaved-navigation'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { afterClosingBackEntry } from '@/lib/navigation/back-layers'
import {
  deleteAutomationAction,
  saveAutomationAction
} from '@/server/orchestrator/automations/automation-management-actions'
import {
  clearPendingAutomationDraft,
  readPendingAutomationDraft,
  type PendingAutomationDraft
} from '@/shared/model/automation-draft/pending-automation-draft'
import { workflowTraceHref } from '@/shared/model/workflow-trace-href'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog'
import { AutomationStepsList } from '../steps/list/automation-steps-list'
import { collectStepReferenceIssues } from '../steps/shared/automation-step-reference-issues'
import { AutomationDetailsSection } from './automation-details-section'
import { AutomationEditorActions } from './automation-editor-actions'
import { AiDraftDialog } from './automation-editor-dialogs'
import { AutomationYamlEditorSection } from './automation-yaml-editor-section'
import {
  automationToForm,
  buildYaml,
  defaultForm,
  preferredWorkflowAction,
  definitionToForm,
  type AutomationFormState,
  type AutomationStepForm
} from './builder-utils'
import { useAutomationAiDraft } from './use-automation-ai-draft'
import { useAutomationEditorDraft } from './use-automation-editor-draft'
import { useAutomationEditorHistory } from './use-automation-editor-history'
import { useAutomationEditorSelection } from './use-automation-editor-selection'
import { downloadWorkflowYaml, useAutomationWorkflowFiles } from './use-automation-workflow-files'
import { WorkflowEditorWorkspace } from './workflow-editor-workspace'
import type { AutomationEditorPageProps } from './types'
import type { Automation } from '@/shared/contracts/automation'

export function AutomationEditorPage({
  initialAutomation,
  draftOwnerUserId,
  initialCommands,
  canUseAi,
  canManageAi
}: AutomationEditorPageProps) {
  const router = useRouter()
  const [automation, setAutomation] = useState<Automation | null>(initialAutomation ?? null)
  const [initialForm] = useState(() =>
    initialAutomation
      ? automationToForm(initialAutomation)
      : defaultForm(preferredWorkflowAction(initialCommands, 'android.viewerCommand') ?? null)
  )
  const history = useAutomationEditorHistory(initialForm)
  const {
    form,
    yamlOpen,
    yamlDraft,
    visualYaml,
    commitEditorChange,
    changeEditorView,
    hasUnsavedChanges,
    markEditorSaved
  } = history
  const referenceIssues = useMemo(
    () => collectStepReferenceIssues(form.steps, initialCommands),
    [form.steps, initialCommands]
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
  const [saving, setSaving] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const restoredDraft = useRef(false)
  const [incomingDraft, setIncomingDraft] = useState<PendingAutomationDraft | null>(null)
  const workflowId = automation?.id
  const isNew = !automation
  const title = form.name.trim() || automation?.name || 'New workflow'
  const draft = useAutomationEditorDraft({
    form,
    yamlOpen,
    yamlDraft,
    visualYaml,
    hasBrokenReferences: referenceIssues.size > 0,
    saving,
    validateImmediately: incomingDraft?.yaml === yamlDraft,
    changeEditorView
  })
  const { currentYaml, yamlForSaveOrExport, toggleYamlEditor, visualError, yamlError, yamlPending } = draft
  const saveInFlight = useRef(false)
  const saveFeedback = useSaveFeedback(currentYaml)
  const navigation = useUnsavedNavigation({
    hasUnsavedChanges,
    push: router.push,
    onDiscard: () => {
      if (incomingDraft) clearPendingAutomationDraft(incomingDraft)
      setIncomingDraft(null)
      history.discardChanges()
    }
  })
  const {
    aiDraftOpen,
    aiDraftPrompt,
    aiDraftClarificationAnswer,
    aiDraftClarificationQuestion,
    aiDraftLog,
    aiDraftError,
    aiDraftResult,
    aiDraftStatus,
    aiModelCatalog,
    applyDraft,
    canDraftFromPrompt,
    catalogStatus,
    cancelDraft,
    draftFromPrompt,
    selectedAiDraftModel,
    selectedAiDraftProvider,
    setAiDraftClarificationAnswer,
    selectAiDraftModel,
    setAiDraftOpen,
    setAiDraftPrompt,
    submitClarification
  } = useAutomationAiDraft({
    canUseAi,
    commitEditorChange,
    setBusy,
    workflowId: automation?.id ?? form.id
  })
  const { handleWorkflowImport, importWorkflow } = useAutomationWorkflowFiles({
    commitEditorChange,
    workflowId: automation?.id ?? form.id,
    importInputRef,
    resetSelectionForSteps,
    setBusy,
    yamlOpen
  })

  const exportWorkflow = () => {
    if (busy || yamlForSaveOrExport === null) return
    downloadWorkflowYaml(form.name || title, yamlForSaveOrExport)
  }

  useLayoutEffect(() => {
    if (!isNew || !draftOwnerUserId || restoredDraft.current) return
    restoredDraft.current = true
    const pendingDraft = readPendingAutomationDraft(draftOwnerUserId)
    if (!pendingDraft) return

    setIncomingDraft(pendingDraft)
    commitEditorChange(snapshot => ({ ...snapshot, yamlOpen: true, yamlDraft: pendingDraft.yaml }))
  }, [isNew, draftOwnerUserId, commitEditorChange])

  useEffect(() => {
    if (!incomingDraft || !draft.validatedDefinition) return
    if (yamlOpen) {
      const nextForm = definitionToForm(draft.validatedDefinition, form.id)
      changeEditorView(snapshot => {
        if (!snapshot.yamlOpen || snapshot.yamlDraft !== yamlDraft) return snapshot
        return { ...snapshot, form: nextForm }
      })
      resetSelectionForSteps(nextForm.steps)
    }
    clearPendingAutomationDraft(incomingDraft)
    setIncomingDraft(null)
  }, [draft.validatedDefinition, form.id, changeEditorView, incomingDraft, resetSelectionForSteps, yamlDraft, yamlOpen])

  const updateForm = (patch: Partial<AutomationFormState>) =>
    commitEditorChange(snapshot => ({ ...snapshot, form: { ...snapshot.form, ...patch } }))

  const updateSteps = (steps: AutomationStepForm[]) => {
    updateForm({ steps })
  }

  const updateStepAt = (index: number, step: AutomationStepForm) => {
    updateSteps(form.steps.map((item, itemIndex) => (itemIndex === index ? step : item)))
  }

  const persistAutomation = async (input: { yaml: string }) => {
    const wasNew = !automation
    const result = await saveAutomationAction(automation?.id ?? null, input)
    if (!result.ok) {
      const validationError = result.error.fieldErrors?.yaml?.[0]
      if (yamlOpen && validationError) {
        draft.reportSaveError(validationError)
        return
      }
      throw new Error(validationError ?? result.error.message)
    }
    if (incomingDraft) {
      clearPendingAutomationDraft(incomingDraft)
      setIncomingDraft(null)
    }
    const saved = result.data
    const savedForm = definitionToForm(saved.definition, saved.id, form.steps)
    const savedVisualYaml = buildYaml(savedForm)
    const nextForm = visualYaml === savedVisualYaml ? { ...form, id: saved.id } : savedForm
    saveFeedback.confirmSaved(yamlOpen ? saved.yaml : savedVisualYaml)
    setAutomation(saved)
    markEditorSaved({
      form: nextForm,
      yamlOpen,
      yamlDraft: yamlOpen ? saved.yaml : ''
    })
    toast({ title: wasNew ? 'Workflow created' : 'Workflow updated', variant: 'success' })
    if (wasNew) {
      afterClosingBackEntry(() => router.replace(`/automations/${saved.id}`))
    }
  }

  const save = async () => {
    if (busy || saveInFlight.current || draft.switchingToVisual || !draft.canSave) return
    saveInFlight.current = true
    setBusy(true)
    saveFeedback.resetSaveFeedback()
    setSaving(true)
    try {
      if (currentYaml !== null) await persistAutomation({ yaml: currentYaml })
    } catch (error) {
      toast({
        title: 'Could not save workflow',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setBusy(false)
      setSaving(false)
      saveInFlight.current = false
    }
  }

  const remove = async () => {
    if (!automation) return
    setBusy(true)
    try {
      await deleteAutomationAction(automation.id)
      toast({ title: 'Workflow deleted', variant: 'success' })
      afterClosingBackEntry(() => router.replace('/automations'))
    } catch (error) {
      toast({
        title: 'Could not delete workflow',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
      setBusy(false)
    }
  }

  return (
    <>
      <WorkflowEditorWorkspace
        title={title}
        onRename={name => updateForm({ name })}
        actions={
          <AutomationEditorActions
            details={
              <FieldChangesProvider
                value={form}
                baseline={automation ? history.savedForm : undefined}
              >
                <AutomationDetailsSection
                  form={form}
                  onChange={updateForm}
                />
              </FieldChangesProvider>
            }
            busy={busy || draft.switchingToVisual}
            saving={saving}
            canSave={draft.canSave}
            saved={saveFeedback.saved}
            canSaveOrExport={yamlForSaveOrExport !== null}
            canDraftFromPrompt={canDraftFromPrompt}
            canDelete={Boolean(automation)}
            yamlOpen={yamlOpen}
            onDelete={() => setDeleteOpen(true)}
            onDraftFromPrompt={() => setAiDraftOpen(true)}
            onExport={exportWorkflow}
            onRunHistory={workflowId ? () => navigation.requestNavigation(workflowTraceHref(workflowId)) : undefined}
            onImport={importWorkflow}
            onSave={() => void save()}
            onToggleYaml={toggleYamlEditor}
          />
        }
        yamlOpen={yamlOpen}
        disabled={busy || draft.switchingToVisual}
        onToggleYaml={toggleYamlEditor}
        history={history}
      >
        {yamlOpen ? (
          <AutomationYamlEditorSection
            yaml={yamlDraft}
            commands={initialCommands}
            onYamlChange={yaml => commitEditorChange(snapshot => ({ ...snapshot, yamlDraft: yaml }))}
            error={yamlError}
            errorFocusRequest={draft.errorFocusRequest}
            pending={yamlPending || draft.switchingToVisual}
            onRetryValidation={incomingDraft && !busy ? draft.retryYamlValidation : undefined}
          />
        ) : (
          <>
            {visualError ? (
              <Notice
                tone='danger'
                className='mb-3'
              >
                {visualError}
              </Notice>
            ) : null}
            <AutomationStepsList
              steps={form.steps}
              referenceIssues={referenceIssues}
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
              className='w-full'
            />
          </>
        )}
      </WorkflowEditorWorkspace>

      <AiDraftDialog
        open={aiDraftOpen && canDraftFromPrompt}
        busy={busy}
        catalog={aiModelCatalog}
        catalogStatus={catalogStatus}
        canManageAi={canManageAi}
        draftError={aiDraftError}
        clarificationAnswer={aiDraftClarificationAnswer}
        clarificationQuestion={aiDraftClarificationQuestion}
        draftLog={aiDraftLog}
        draftStatus={aiDraftStatus}
        hasDraftResult={Boolean(aiDraftResult)}
        providerId={selectedAiDraftProvider?.id ?? ''}
        modelId={selectedAiDraftModel?.id ?? ''}
        prompt={aiDraftPrompt}
        onApplyDraft={applyDraft}
        onCancelDraft={cancelDraft}
        onDraft={() => void draftFromPrompt()}
        onClarificationAnswerChange={setAiDraftClarificationAnswer}
        onSelectModel={selectAiDraftModel}
        onOpenChange={setAiDraftOpen}
        onPromptChange={setAiDraftPrompt}
        onSubmitClarification={() => void submitClarification()}
      />

      <input
        ref={importInputRef}
        type='file'
        accept='.yaml,.yml,text/yaml,application/x-yaml'
        className='hidden'
        onChange={event => void handleWorkflowImport(event.currentTarget.files?.[0] ?? null)}
      />

      <ConfirmMutationDialog
        open={deleteOpen}
        title={`Delete ${automation?.name ?? 'workflow'}?`}
        description='Rebroid deletes the workflow and its triggers and keeps past runs.'
        confirmLabel='Delete workflow'
        pendingLabel='Deleting…'
        pending={busy}
        onConfirm={() => void remove()}
        onOpenChange={setDeleteOpen}
      />

      <UnsavedChangesDialog
        navigation={navigation}
        description='This workflow has unsaved changes.'
      />
    </>
  )
}
