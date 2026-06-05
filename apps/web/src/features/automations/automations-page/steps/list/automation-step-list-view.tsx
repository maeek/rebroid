'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { IconClipboard, IconPlus } from '@tabler/icons-react'
import classNames from 'classnames'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import {
  defaultConditionStep,
  defaultRepeatStep,
  defaultStep,
  defaultSwitchStep,
  type AutomationStepForm
} from '../../editor/builder-utils'
import {
  cloneAutomationStep,
  copyAutomationStepToClipboard,
  readAutomationStepFromClipboard
} from '../shared/automation-step-clipboard'
import { ROOT_STEP_LIST_ID } from '../tree/automation-step-tree'
import { getStepListDropId } from './automation-step-drop-target'
import { AutomationStepRow } from './automation-step-row'
import { useAutomationStepsContext } from './automation-steps-context'

function AutomationStepDropIndicator({ top }: { top: number }) {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute left-1 right-1 z-20 h-0.5 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.75)]'
      style={{ top }}
    />
  )
}

export function AutomationStepListView({ listId, steps }: { listId: string; steps: AutomationStepForm[] }) {
  const { commands, expandedStepKeys, dropTarget, onToggleStep, onListChange } = useAutomationStepsContext()
  const visibleExpandedStepKeys = listId === ROOT_STEP_LIST_ID ? expandedStepKeys : steps.map(step => step.clientKey)
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
    onToggleStep(step.clientKey)
  }

  const duplicateStep = (index: number) => {
    const source = steps[index]
    if (!source) return
    const nextStep = cloneAutomationStep(source, '-copy')
    onListChange(listId, [...steps.slice(0, index + 1), nextStep, ...steps.slice(index + 1)])
  }

  const pasteStep = async () => {
    try {
      const step = await readAutomationStepFromClipboard()
      if (!step) {
        toast({
          title: 'Clipboard does not contain a workflow block',
          variant: 'destructive'
        })
        return
      }
      onListChange(listId, [...steps, step])
      onToggleStep(step.clientKey)
      toast({ title: 'Block pasted' })
    } catch (error) {
      toast({
        title: 'Could not paste block',
        description: error instanceof Error ? error.message : 'Clipboard access failed.',
        variant: 'destructive'
      })
    }
  }

  const renderNestedSteps = (
    nestedSteps: AutomationStepForm[],
    nestedListId: string,
    _nestedExpandedStepKeys: string[]
  ) => (
    <AutomationStepListView
      listId={nestedListId}
      steps={nestedSteps}
    />
  )

  return (
    <section className='grid min-w-0 content-start gap-3'>
      <div className='flex h-8 items-center justify-between gap-3'>
        <h3 className='text-xl font-medium'>Steps</h3>
      </div>

      <div
        ref={setNodeRef}
        className={classNames(
          'grid gap-2 rounded-md transition-colors',
          isOver ? 'bg-primary/10 ring-1 ring-primary/40' : null
        )}
      >
        <div
          ref={listItemsRef}
          className={classNames(
            'relative grid min-h-12 gap-2',
            steps.length === 0 ? 'border border-dashed border-border/60 p-3' : null
          )}
        >
          {steps.map((step, index) => (
            <AutomationStepRow
              key={step.clientKey}
              listId={listId}
              step={step}
              index={index}
              expanded={visibleExpandedStepKeys.includes(step.clientKey)}
              canMoveUp={index > 0}
              canMoveDown={index < steps.length - 1}
              onCopy={() => {
                void copyAutomationStepToClipboard(step)
                  .then(() => toast({ title: 'Block copied' }))
                  .catch(error =>
                    toast({
                      title: 'Could not copy block',
                      description: error instanceof Error ? error.message : 'Clipboard access failed.',
                      variant: 'destructive'
                    })
                  )
              }}
              onDuplicate={() => duplicateStep(index)}
              onDelete={() =>
                onListChange(
                  listId,
                  steps.filter((_, itemIndex) => itemIndex !== index)
                )
              }
              renderNestedSteps={renderNestedSteps}
            />
          ))}
          {dropIndicatorTop !== null ? <AutomationStepDropIndicator top={dropIndicatorTop} /> : null}
          {steps.length === 0 ? (
            <div className='py-3 text-center text-sm text-secondary-foreground'>Drop steps here</div>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              className='h-9'
            >
              <IconPlus className='size-4' />
              Add step
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='center'
            className='min-w-44 p-2'
          >
            <DropdownMenuItem onSelect={() => addStep('action')}>Action</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addStep('condition')}>Condition</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addStep('switch')}>Switch</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addStep('repeat')}>Repeat</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='gap-2'
              onSelect={() => void pasteStep()}
            >
              <IconClipboard className='size-4' />
              Paste block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  )
}
