'use client'

import { useMemo } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Surface } from '@/components/ui/surface'
import { AutomationStepBlockSettingsEditor } from '../editors/automation-step-block-settings-editor'
import { AutomationStepEditor } from '../editors/automation-step-editor'
import { AutomationStepYamlEditor } from '../editors/automation-step-yaml-editor'
import { collectStepReferenceOptions } from '../shared/automation-step-reference-options'
import { AutomationStepInspectorHeader } from './automation-step-inspector-header'
import { useMediaQuery } from './use-media-query'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationStepInspector({
  step,
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
          className='overflow-hidden'
        >
          {step ? (
            <AutomationStepInspectorContent
              step={step}
              rootSteps={rootSteps}
              commands={commands}
              commandByUses={commandByUses}
              yamlStepKey={yamlStepKey}
              onYamlStepKeyChange={onYamlStepKeyChange}
              onChange={onChange}
            />
          ) : (
            <div className='grid min-h-56 content-center gap-2 px-6 py-10 text-center text-sm text-foreground-muted'>
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
  rootSteps,
  commands,
  commandByUses,
  yamlStepKey,
  onYamlStepKeyChange,
  onChange,
  onClose
}: {
  step: AutomationStepForm
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

  return (
    <div className='grid max-h-[calc(100dvh-7rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden xl:max-h-[calc(var(--console-content-height)-3rem)]'>
      <AutomationStepInspectorHeader
        step={step}
        command={command}
        yamlMode={yamlMode}
        onToggleYaml={step.kind === 'action' ? () => onYamlStepKeyChange(yamlMode ? null : step.clientKey) : undefined}
        onClose={onClose}
      />
      <div className='scrollbar-thin min-h-0 overflow-x-hidden overflow-y-auto px-6 pb-6 max-sm:px-4 max-sm:pb-4'>
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
              surface='plain'
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
  )
}
