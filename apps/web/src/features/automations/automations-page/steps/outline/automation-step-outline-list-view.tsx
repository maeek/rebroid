'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import {
  defaultConditionStep,
  defaultRepeatStep,
  defaultStep,
  defaultSwitchStep,
  type AutomationStepForm
} from '../../editor/builder-utils'
import { workflowBlockChoices } from '../catalog/automation-action-picker'
import { getStepListDropId } from '../list/automation-step-drop-target'
import { useAutomationStepsContext } from '../list/automation-steps-context'
import {
  cloneAutomationStep,
  copyAutomationStepToClipboard,
  readAutomationStepFromClipboard
} from '../shared/automation-step-clipboard'
import { visitStepScopes } from '../tree/automation-step-tree'
import { AutomationStepAddRow } from './automation-step-add-row'
import { AutomationStepBranchLane } from './automation-step-branch-lane'
import { AutomationStepDropIndicator } from './automation-step-drop-indicator'
import { AutomationStepOutlineRow } from './automation-step-outline-row'

export function AutomationStepOutlineListView({
  listId,
  steps,
  root = false
}: {
  listId: string
  steps: AutomationStepForm[]
  root?: boolean
}) {
  const { rootSteps, commands, openBlockKeys, dropTarget, onSelectStep, onOpenBlock, onListChange, onDeleteStep } =
    useAutomationStepsContext()
  const { setNodeRef } = useDroppable({
    id: getStepListDropId(listId),
    data: { type: 'step-list', listId }
  })
  const dropTargetIndex = dropTarget?.listId === listId ? dropTarget.index : null
  const listItemsRef = useRef<HTMLDivElement | null>(null)
  const setListRef = useCallback(
    (node: HTMLDivElement | null) => {
      listItemsRef.current = node
      setNodeRef(node)
    },
    [setNodeRef]
  )
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null)

  useLayoutEffect(() => {
    const listElement = listItemsRef.current
    if (dropTargetIndex === null || !listElement) {
      setDropIndicatorTop(null)
      return
    }

    const rows = Array.from(listElement.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.automationStepItem === 'true'
    )
    const targetRow = rows[dropTargetIndex]
    const previousRow = rows[dropTargetIndex - 1]
    const referenceTop = targetRow
      ? targetRow.offsetTop
      : previousRow
        ? previousRow.offsetTop + previousRow.offsetHeight
        : listElement.offsetHeight / 2

    setDropIndicatorTop(referenceTop)
  }, [dropTargetIndex, steps])

  const addStep = (choice: string) => {
    const kind = workflowBlockChoices.find(block => block === choice) ?? 'action'
    const index = steps.length + 1
    let step: AutomationStepForm
    switch (kind) {
      case 'condition':
        step = { ...defaultConditionStep(index), thenSteps: [] }
        break
      case 'switch':
        step = { ...defaultSwitchStep(index), cases: [] }
        break
      case 'repeat':
        step = { ...defaultRepeatStep(index), steps: [] }
        break
      case 'action': {
        const action = commands.find(command => command.uses === choice)
        if (!action) return
        step = defaultStep(action, index)
        break
      }
    }
    const usedIds = new Set<string>()
    visitStepScopes(rootSteps, (_, id) => {
      usedIds.add(id)
    })
    const base = step.id
    let suffix = 2
    while (usedIds.has(step.id)) step.id = `${base}-${suffix++}`
    onListChange(listId, [...steps, step])
    onSelectStep(step.clientKey)
    if (step.kind !== 'action') onOpenBlock(step.clientKey)
  }

  const duplicateStep = (index: number) => {
    const source = steps[index]
    if (!source) return
    const nextStep = cloneAutomationStep(source, rootSteps)
    onListChange(listId, [...steps.slice(0, index + 1), nextStep, ...steps.slice(index + 1)])
    onSelectStep(nextStep.clientKey)
    if (nextStep.kind !== 'action') onOpenBlock(nextStep.clientKey)
  }

  const pasteStep = async () => {
    try {
      const nextStep = await readAutomationStepFromClipboard(rootSteps)
      if (!nextStep) {
        toast({
          title: 'Clipboard does not contain a workflow block',
          variant: 'danger'
        })
        return
      }
      onListChange(listId, [...steps, nextStep])
      onSelectStep(nextStep.clientKey)
      if (nextStep.kind !== 'action') onOpenBlock(nextStep.clientKey)
      toast({ title: 'Block pasted' })
    } catch (error) {
      toast({
        title: 'Could not paste block',
        description: error instanceof Error ? error.message : 'Clipboard access failed.',
        variant: 'danger'
      })
    }
  }

  return (
    <Section
      surface='plain'
      title={root ? 'Step sequence' : undefined}
      className='min-w-0'
      contentClassName='gap-3'
    >
      <div className='grid min-w-0 gap-2'>
        <div
          ref={setListRef}
          className='relative grid min-h-10 gap-2'
        >
          {steps.map((step, index) => (
            <div
              key={step.clientKey}
              data-automation-step-item='true'
              className='grid min-w-0 gap-2'
            >
              <AutomationStepOutlineRow
                listId={listId}
                step={step}
                index={index}
                canMoveUp={index > 0}
                canMoveDown={index < steps.length - 1}
                onCopy={() => {
                  void copyAutomationStepToClipboard(step)
                    .then(() => toast({ title: 'Block copied' }))
                    .catch(error =>
                      toast({
                        title: 'Could not copy block',
                        description: error instanceof Error ? error.message : 'Clipboard access failed.',
                        variant: 'danger'
                      })
                    )
                }}
                onDuplicate={() => duplicateStep(index)}
                onDelete={() => onDeleteStep(step.clientKey)}
              />
              {step.kind !== 'action' && openBlockKeys.includes(step.clientKey) ? (
                <AutomationStepBranchLanes step={step} />
              ) : null}
            </div>
          ))}
          <AutomationStepAddRow
            dropping={steps.length === 0 && dropTargetIndex !== null}
            commands={commands}
            onAdd={addStep}
            onPaste={() => void pasteStep()}
          />
          {dropIndicatorTop !== null ? <AutomationStepDropIndicator top={dropIndicatorTop} /> : null}
        </div>
      </div>
    </Section>
  )
}

function AutomationStepBranchLanes({ step }: { step: Exclude<AutomationStepForm, { kind: 'action' }> }) {
  if (step.kind === 'condition') {
    return (
      <div className='grid gap-3'>
        <AutomationStepBranchLane title='Then'>
          <AutomationStepOutlineListView
            listId={`${step.clientKey}:then`}
            steps={step.thenSteps}
          />
        </AutomationStepBranchLane>
        <AutomationStepBranchLane title='Otherwise'>
          <AutomationStepOutlineListView
            listId={`${step.clientKey}:else`}
            steps={step.elseSteps}
          />
        </AutomationStepBranchLane>
      </div>
    )
  }

  if (step.kind === 'switch') {
    return (
      <div className='grid gap-3'>
        {step.cases.map(item => (
          <AutomationStepBranchLane
            key={item.clientKey}
            title={`Case ${JSON.stringify(item.value) ?? 'unset'}`}
          >
            <AutomationStepOutlineListView
              listId={`${step.clientKey}:case:${item.clientKey}`}
              steps={item.steps}
            />
          </AutomationStepBranchLane>
        ))}
        <AutomationStepBranchLane title='Otherwise'>
          <AutomationStepOutlineListView
            listId={`${step.clientKey}:default`}
            steps={step.defaultSteps}
          />
        </AutomationStepBranchLane>
      </div>
    )
  }

  return (
    <AutomationStepBranchLane title='Repeated steps'>
      <AutomationStepOutlineListView
        listId={`${step.clientKey}:steps`}
        steps={step.steps}
      />
    </AutomationStepBranchLane>
  )
}
