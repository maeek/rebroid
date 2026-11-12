'use client'

import { useState } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { getAutomationActionDefinitions } from '../actions/action-registry'
import { WorkflowResourceNavigation } from '../shared/workflow-resource-navigation'
import { AutomationStepsList } from '../steps/list/automation-steps-list'
import { AutomationDetailsSection } from './automation-details-section'
import { AutomationEditorActions } from './automation-editor-actions'
import { AutomationYamlEditorSection } from './automation-yaml-editor-section'
import { buildYaml, defaultForm, defaultStep, type AutomationFormState } from './builder-utils'
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
  inputSchema: { type: 'object' },
  outputs: [],
  editor: { inputDefaults: action.defaultInput(), inputFieldOrder: [], yamlSnippetFields: [] }
}))

const noop = () => undefined

export const WorkflowEditorPreview = ({ creating = false }: { creating?: boolean }) => {
  const [form, setForm] = useState<AutomationFormState>(() =>
    creating
      ? defaultForm()
      : {
          ...defaultForm(),
          id: 'preview-workflow',
          name: 'Daily inventory check',
          steps: [
            defaultStep('android.viewerCommand', 1, 'wake'),
            defaultStep('android.wait', 2, 'wait'),
            defaultStep('debug.log', 3, 'log')
          ]
        }
  )
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yaml, setYaml] = useState('')
  const selection = useAutomationEditorSelection(form.steps)
  return (
    <StandardPage className='gap-0'>
      <PageHeader
        section={{ label: 'Automations' }}
        trail={[{ label: 'Workflows', href: '/automations' }]}
        title={creating ? 'New workflow' : form.name}
        description={
          creating ? 'Create a reusable workflow.' : 'Edit workflow steps, settings, and execution behavior.'
        }
        actions={
          <AutomationEditorActions
            busy={false}
            canDraftFromPrompt={false}
            canDelete={!creating}
            yamlOpen={yamlOpen}
            yamlValid
            onSave={noop}
            onDelete={noop}
            onDraftFromPrompt={noop}
            onImport={noop}
            onExport={noop}
          />
        }
      />
      <PageContent className='grid gap-6 pt-2'>
        <WorkflowResourceNavigation
          workflowId={form.id ?? undefined}
          active='editor'
        />
        <WorkflowEditorWorkspace
          details={
            <AutomationDetailsSection
              form={form}
              onChange={patch => setForm(current => ({ ...current, ...patch }))}
            />
          }
          yamlOpen={yamlOpen}
          onToggleYaml={() => {
            setYaml(buildYaml(form))
            setYamlOpen(current => !current)
          }}
        >
          {yamlOpen ? (
            <AutomationYamlEditorSection
              yaml={yaml}
              commands={previewCommands}
              onYamlChange={setYaml}
            />
          ) : (
            <AutomationStepsList
              steps={form.steps}
              commands={previewCommands}
              selectedStepKey={selection.selectedStepKey}
              openBlockKeys={selection.openBlockKeys}
              yamlStepKey={selection.yamlStepKey}
              onSelectStep={selection.setSelectedStepKey}
              onToggleBlock={selection.toggleBlock}
              onOpenBlock={selection.openBlock}
              onYamlStepKeyChange={selection.setYamlStepKey}
              onChange={steps => setForm(current => ({ ...current, steps }))}
              onStepChange={(index, step) =>
                setForm(current => ({ ...current, steps: current.steps.map((item, i) => (i === index ? step : item)) }))
              }
            />
          )}
        </WorkflowEditorWorkspace>
      </PageContent>
    </StandardPage>
  )
}
