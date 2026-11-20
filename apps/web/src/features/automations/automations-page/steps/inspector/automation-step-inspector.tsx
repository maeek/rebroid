'use client'

import { useMemo } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Notice } from '@/components/ui/notice'
import { Surface } from '@/components/ui/surface'
import { getActionUiStateFromInput, getDefaultActionInput } from '../../actions/action-registry'
import { AutomationReplaceBlockMenu } from '../catalog/automation-replace-block-menu'
import { AutomationStepBlockSettingsEditor } from '../editors/automation-step-block-settings-editor'
import { AutomationStepEditor } from '../editors/automation-step-editor'
import { AutomationStepYamlEditor } from '../editors/automation-step-yaml-editor'
import { collectStepReferenceOptions } from '../shared/automation-step-reference-options'
import { AutomationStepInspectorHeader } from './automation-step-inspector-header'
import { useMediaQuery } from './use-media-query'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { StepReferenceIssues } from '../shared/automation-step-reference-issues'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationStepInspector({
  step,
  referenceIssues,
  mobileOpen,
  returnFocus,
  rootSteps,
  commands,
  commandByUses,
  yamlStepKey,
  onYamlStepKeyChange,
  onChange,
  onClose
}: {
  step: AutomationStepForm | null
  referenceIssues?: StepReferenceIssues
  mobileOpen: boolean
  returnFocus: () => HTMLElement | null
  rootSteps: AutomationStepForm[]
  commands: AutomationCommand[]
  commandByUses: Map<string, AutomationCommand>
  yamlStepKey: string | null
  onYamlStepKeyChange: (clientKey: string | null) => void
  onChange: (step: AutomationStepForm) => void
  onClose: () => void
}) {
  const isDesktop = useMediaQuery('(min-width: 1280px)')

  return (
    <>
      <aside
        aria-label='Step configuration'
        className='hidden min-w-0 xl:block'
      >
        <Surface
          level='panel'
          className='grid min-h-(--workflow-editor-height) overflow-hidden border-0'
        >
          {step ? (
            <AutomationStepInspectorContent
              step={step}
              referenceIssues={referenceIssues}
              rootSteps={rootSteps}
              commands={commands}
              commandByUses={commandByUses}
              yamlStepKey={yamlStepKey}
              onYamlStepKeyChange={onYamlStepKeyChange}
              onChange={onChange}
            />
          ) : (
            <div className='grid content-center gap-2 px-6 py-10 text-center text-sm text-foreground-muted'>
              <span className='font-medium text-foreground'>Step configuration</span>
              <span>Select a step from the sequence to edit its action and settings.</span>
            </div>
          )}
        </Surface>
      </aside>

      {isDesktop === false ? (
        <Drawer
          open={mobileOpen && Boolean(step)}
          onOpenChange={open => {
            if (!open) onClose()
          }}
        >
          <DrawerContent
            className='max-h-[88dvh] overflow-hidden'
            finalFocus={returnFocus}
          >
            <DrawerTitle className='sr-only'>{step ? 'Edit step' : 'No step selected'}</DrawerTitle>
            <DrawerDescription className='sr-only'>Edit the selected workflow step.</DrawerDescription>
            {step ? (
              <AutomationStepInspectorContent
                step={step}
                referenceIssues={referenceIssues}
                rootSteps={rootSteps}
                commands={commands}
                commandByUses={commandByUses}
                yamlStepKey={yamlStepKey}
                onYamlStepKeyChange={onYamlStepKeyChange}
                onChange={onChange}
                onClose={onClose}
              />
            ) : null}
          </DrawerContent>
        </Drawer>
      ) : null}
    </>
  )
}

function AutomationStepInspectorContent({
  step,
  referenceIssues,
  rootSteps,
  commands,
  commandByUses,
  yamlStepKey,
  onYamlStepKeyChange,
  onChange,
  onClose
}: {
  step: AutomationStepForm
  referenceIssues?: StepReferenceIssues
  rootSteps: AutomationStepForm[]
  commands: AutomationCommand[]
  commandByUses: Map<string, AutomationCommand>
  yamlStepKey: string | null
  onYamlStepKeyChange: (clientKey: string | null) => void
  onChange: (step: AutomationStepForm) => void
  onClose?: () => void
}) {
  const command = step.kind === 'action' ? commandByUses.get(step.uses) : undefined
  const stepOptions = useMemo(
    () => collectStepReferenceOptions(rootSteps, step.clientKey, commandByUses),
    [commandByUses, rootSteps, step.clientKey]
  )
  const yamlMode = step.kind === 'action' && yamlStepKey === step.clientKey
  const emptyRequiredBranch =
    (step.kind === 'condition' && step.thenSteps.length === 0) ||
    (step.kind === 'repeat' && step.steps.length === 0) ||
    (step.kind === 'switch' && step.cases.some(item => item.steps.length === 0))

  return (
    <div className='grid max-h-[calc(100dvh-7rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden xl:max-h-(--workflow-editor-height)'>
      <AutomationStepInspectorHeader
        step={step}
        command={command}
        yamlMode={yamlMode}
        actionControl={
          step.kind === 'action' && !yamlMode ? (
            <AutomationReplaceBlockMenu
              key={step.clientKey}
              commands={commands}
              value={step.uses}
              onReplace={uses => {
                const input = getDefaultActionInput(uses, commandByUses.get(uses))
                onChange({
                  ...step,
                  uses,
                  withJson: JSON.stringify(input, null, 2),
                  uiState: getActionUiStateFromInput(uses, input)
                })
              }}
            />
          ) : null
        }
        onToggleYaml={step.kind === 'action' ? () => onYamlStepKeyChange(yamlMode ? null : step.clientKey) : undefined}
        onClose={onClose}
      />
      <div className='scrollbar-thin min-h-0 overflow-x-hidden overflow-y-auto transform-gpu px-6 pb-6 max-sm:px-4 max-sm:pb-4'>
        <div className='min-w-0'>
          {emptyRequiredBranch ? (
            <Notice
              tone='warning'
              className='mb-4'
              title='Add a step to this block'
            >
              {step.kind === 'condition'
                ? 'The Then branch needs at least one step.'
                : step.kind === 'repeat'
                  ? 'The repeat body needs at least one step.'
                  : 'Each case needs at least one step.'}
            </Notice>
          ) : null}
          {referenceIssues ? (
            <Notice
              tone='warning'
              className='mb-4'
              title='Broken step references'
            >
              <ul className='grid list-disc gap-1 pl-4 [overflow-wrap:anywhere]'>
                {referenceIssues.issues.map(({ field, reference }) => (
                  <li key={field}>
                    {field} uses{' '}
                    <code>
                      {reference.stepId}.{reference.outputKey}
                    </code>
                    , which is unavailable at this step.
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}
          {step.kind === 'action' ? (
            yamlMode ? (
              <AutomationStepYamlEditor
                step={step}
                command={command}
                onChange={onChange}
              />
            ) : (
              <AutomationStepEditor
                step={step}
                commands={commands}
                stepOptions={stepOptions}
                onChange={onChange}
              />
            )
          ) : (
            <AutomationStepBlockSettingsEditor
              step={step}
              stepOptions={stepOptions}
              onChange={onChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}
