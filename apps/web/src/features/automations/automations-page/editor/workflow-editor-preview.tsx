'use client'

import { useMemo, useState } from 'react'
import { summaryOutput } from '@rebroid/automation-core/command-registry'
import { useRouter } from 'next/navigation'
import { workflowTraceHref } from '@/shared/model/workflow-trace-href'
import { getAutomationActionDefinitions } from '../actions/action-registry'
import { AutomationStepsList } from '../steps/list/automation-steps-list'
import { collectStepReferenceIssues } from '../steps/shared/automation-step-reference-issues'
import { AutomationDetailsSection } from './automation-details-section'
import { AutomationEditorActions } from './automation-editor-actions'
import { AutomationYamlEditorSection } from './automation-yaml-editor-section'
import { defaultForm, defaultStep, type AutomationFormState } from './builder-utils'
import { useAutomationEditorHistory } from './use-automation-editor-history'
import { useAutomationEditorSelection } from './use-automation-editor-selection'
import { WorkflowEditorWorkspace } from './workflow-editor-workspace'
import type { AutomationCommand } from '@/shared/contracts/automation'

const commandLabels: Record<string, string> = {
  'android.viewerCommand': 'Viewer command',
  'android.wait': 'Wait',
  'debug.log': 'Log message'
}

export const previewCommands: AutomationCommand[] = getAutomationActionDefinitions().map(action => ({
  uses: action.uses,
  label: commandLabels[action.uses] ?? action.label ?? action.uses,
  description: action.description ?? '',
  requiredPermissions: [],
  inputSchema:
    action.uses === 'debug.log' ? { type: 'object', properties: { message: { type: 'string' } } } : { type: 'object' },
  outputs: [summaryOutput],
  editor: {
    inputDefaults: action.defaultInput(),
    inputFieldOrder: action.uses === 'debug.log' ? ['message'] : [],
    yamlSnippetFields: []
  }
}))

const noop = () => undefined

export const WorkflowEditorPreview = ({
  creating = false,
  withReferences = false,
  long = false
}: {
  creating?: boolean
  withReferences?: boolean
  long?: boolean
}) => {
  const router = useRouter()
  const [initialForm] = useState<AutomationFormState>(() =>
    creating
      ? defaultForm()
      : {
          ...defaultForm(),
          id: 'preview-workflow',
          name: 'Daily inventory check',
          steps: [
            defaultStep('android.viewerCommand', 1, 'wake'),
            { ...defaultStep('android.wait', 2, 'wait'), id: 'wait' },
            {
              ...defaultStep('debug.log', 3, 'log'),
              id: 'log',
              ...(withReferences
                ? {
                    withJson: JSON.stringify({
                      message: { $ref: { source: 'stepOutput', stepId: 'wait', outputKey: 'summary' } }
                    })
                  }
                : {})
            },
            ...(long
              ? Array.from({ length: 24 }, (_, index) => defaultStep('android.wait', index + 4, `wait-${index + 4}`))
              : [])
          ]
        }
  )
  const history = useAutomationEditorHistory(initialForm)
  const { form, yamlOpen, yamlDraft, visualYaml, commitEditorChange, changeEditorView } = history
  const referenceIssues = useMemo(() => collectStepReferenceIssues(form.steps, previewCommands), [form.steps])
  const hasBrokenReferences = !yamlOpen && referenceIssues.size > 0
  const updateForm = (patch: Partial<AutomationFormState>) =>
    commitEditorChange(snapshot => ({ ...snapshot, form: { ...snapshot.form, ...patch } }))
  const workflowId = form.id
  const selection = useAutomationEditorSelection(form.steps)
  return (
    <WorkflowEditorWorkspace
      title={form.name.trim() || 'New workflow'}
      onRename={name => updateForm({ name })}
      actions={
        <AutomationEditorActions
          details={
            <AutomationDetailsSection
              form={form}
              onChange={updateForm}
            />
          }
          busy={false}
          hasBrokenReferences={hasBrokenReferences}
          canDraftFromPrompt={false}
          canDelete={!creating}
          yamlOpen={yamlOpen}
          yamlValid
          onSave={noop}
          onDelete={noop}
          onDraftFromPrompt={noop}
          onRunHistory={workflowId ? () => router.push(workflowTraceHref(workflowId)) : undefined}
          onImport={noop}
          onExport={noop}
        />
      }
      yamlOpen={yamlOpen}
      history={history}
      onToggleYaml={() =>
        changeEditorView(snapshot => ({ ...snapshot, yamlOpen: !yamlOpen, yamlDraft: visualYaml ?? '' }))
      }
    >
      {yamlOpen ? (
        <AutomationYamlEditorSection
          yaml={yamlDraft}
          commands={previewCommands}
          onYamlChange={yaml => commitEditorChange(snapshot => ({ ...snapshot, yamlDraft: yaml }))}
        />
      ) : (
        <AutomationStepsList
          steps={form.steps}
          referenceIssues={referenceIssues}
          commands={previewCommands}
          selectedStepKey={selection.selectedStepKey}
          openBlockKeys={selection.openBlockKeys}
          yamlStepKey={selection.yamlStepKey}
          onSelectStep={selection.setSelectedStepKey}
          onToggleBlock={selection.toggleBlock}
          onOpenBlock={selection.openBlock}
          onYamlStepKeyChange={selection.setYamlStepKey}
          onChange={steps => updateForm({ steps })}
          onStepChange={(index, step) =>
            updateForm({ steps: form.steps.map((item, i) => (i === index ? step : item)) })
          }
        />
      )}
    </WorkflowEditorWorkspace>
  )
}
