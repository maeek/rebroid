'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import {
  defaultConditionStep,
  defaultRepeatStep,
  defaultStep,
  defaultSwitchStep,
  type AutomationStepForm
} from '../../editor/builder-utils'
import { getStepListDropId } from '../list/automation-step-drop-target'
import { useAutomationStepsContext } from '../list/automation-steps-context'
import {
  cloneAutomationStep,
  copyAutomationStepToClipboard,
  makeAutomationStepIdsUnique,
  readAutomationStepFromClipboard
} from '../shared/automation-step-clipboard'
import { collectStepKeys, selectionAfterDelete } from '../shared/automation-step-selection'
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
  const { rootSteps, commands, selectedStepKey, openBlockKeys, dropTarget, onSelectStep, onOpenBlock, onListChange } =
    useAutomationStepsContext()
  const { setNodeRef, isOver } = useDroppable({
    id: getStepListDropId(listId),
    data: { type: 'step-list', listId }
  })
  const dropTargetIndex = dropTarget?.listId === listId ? dropTarget.index : null
  const listItemsRef = useRef<HTMLDivElement | null>(null)
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
        : 0

    setDropIndicatorTop(referenceTop)
  }, [dropTargetIndex, steps])

  const addStep = (kind: AutomationStepForm['kind'] = 'action') => {
    const step =
      kind === 'condition'
        ? defaultConditionStep(steps.length + 1)
        : kind === 'switch'
          ? defaultSwitchStep(steps.length + 1)
          : kind === 'repeat'
            ? defaultRepeatStep(steps.length + 1)
            : defaultStep(commands[0]?.uses, steps.length + 1)
    onListChange(listId, [...steps, step])
    onSelectStep(step.clientKey)
    if (step.kind !== 'action') onOpenBlock(step.clientKey)
  }

  const duplicateStep = (index: number) => {
    const source = steps[index]
    if (!source) return
    const nextStep = makeAutomationStepIdsUnique(cloneAutomationStep(source, '-copy'), rootSteps)
    onListChange(listId, [...steps.slice(0, index + 1), nextStep, ...steps.slice(index + 1)])
    onSelectStep(nextStep.clientKey)
    if (nextStep.kind !== 'action') onOpenBlock(nextStep.clientKey)
  }

  const pasteStep = async () => {
    try {
      const step = await readAutomationStepFromClipboard()
      if (!step) {
        toast({
          title: 'Clipboard does not contain a workflow block',
          variant: 'danger'
        })
        return
      }
      const nextStep = makeAutomationStepIdsUnique(step, rootSteps)
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

  const deleteStep = (index: number) => {
    const deleted = steps[index]
    if (!deleted) return
    const deletedKeys = new Set(collectStepKeys([deleted]))
    const fallback = selectionAfterDelete(steps, index)
    const globalFallback = collectStepKeys(rootSteps).find(key => !deletedKeys.has(key)) ?? null
    const nextSteps = steps.filter((_, itemIndex) => itemIndex !== index)
    onListChange(listId, nextSteps)
    if (!selectedStepKey || deletedKeys.has(selectedStepKey)) {
      onSelectStep(fallback ?? globalFallback)
    }
  }

  return (
    <section className={cn('grid min-w-0 content-start gap-3', root ? null : 'gap-2')}>
      {root ? (
        <div className='flex h-8 items-center justify-between gap-3'>
          <h3 className='text-xl font-medium'>Steps</h3>
        </div>
      ) : null}

      <div
        ref={setNodeRef}
        className={cn(
          'grid min-w-0 gap-2 rounded-control transition-colors',
          isOver ? 'bg-primary/10 ring-1 ring-primary/40' : null
        )}
      >
        <div
          ref={listItemsRef}
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
                onDelete={() => deleteStep(index)}
              />
              {step.kind !== 'action' && openBlockKeys.includes(step.clientKey) ? (
                <AutomationStepBranchLanes step={step} />
              ) : null}
            </div>
          ))}
          {dropIndicatorTop !== null ? <AutomationStepDropIndicator top={dropIndicatorTop} /> : null}
        </div>

        {steps.length === 0 ? (
          <div className='rounded-control border border-dashed border-surface-border/60 px-3 py-3 text-center text-sm text-foreground-muted'>
            Drop steps here
          </div>
        ) : null}
        <AutomationStepAddRow
          label={root ? 'Add step' : 'Drop or add step'}
          onAdd={addStep}
          onPaste={() => void pasteStep()}
        />
      </div>
    </section>
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
        <AutomationStepBranchLane title='Else'>
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
            title={`Case: ${String(item.value)}`}
          >
            <AutomationStepOutlineListView
              listId={`${step.clientKey}:case:${item.clientKey}`}
              steps={item.steps}
            />
          </AutomationStepBranchLane>
        ))}
        <AutomationStepBranchLane title='Default'>
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
