'use client'

import { useMemo } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { AutomationStepBlockSettingsEditor } from '../editors/automation-step-block-settings-editor'
import { AutomationStepEditor } from '../editors/automation-step-editor'
import { AutomationStepYamlEditor } from '../editors/automation-step-yaml-editor'
import { collectStepReferenceOptions } from '../shared/automation-step-reference-options'
import { AutomationStepInspectorHeader } from './automation-step-inspector-header'
import { useMediaQuery } from './use-media-query'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export function AutomationStepInspector({
  step,
  rootSteps,
  commands,
  commandByUses,
  yamlStepKey,
  onYamlStepKeyChange,
  onChange,
  onClose
}: {
  step: AutomationStepForm | null
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
      <aside className='hidden min-w-0 xl:block'>
        <div className='sticky top-4 overflow-hidden rounded-lg border border-border/70 bg-card/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md'>
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
            <div className='px-4 py-10 text-center text-sm text-secondary-foreground'>Select a step to edit.</div>
          )}
        </div>
      </aside>

      {isDesktop === false ? (
        <Drawer
          open={Boolean(step)}
          onOpenChange={open => {
            if (!open) onClose()
          }}
        >
          <DrawerContent className='max-h-[88dvh] overflow-hidden rounded-t-xl border-border/80 bg-background/95'>
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
    <div className='grid max-h-[88dvh] min-w-0 grid-rows-[auto_minmax(0,1fr)]'>
      <AutomationStepInspectorHeader
        step={step}
        command={command}
        yamlMode={yamlMode}
        onToggleYaml={step.kind === 'action' ? () => onYamlStepKeyChange(yamlMode ? null : step.clientKey) : undefined}
        onClose={onClose}
      />
      <div className='min-h-0 overflow-y-auto px-4 py-4'>
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
              boxed={false}
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
