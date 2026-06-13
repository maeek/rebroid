'use client'

import { useCallback, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconCopy,
  IconCopyCheck,
  IconDotsVertical,
  IconFileCode,
  IconGripVertical,
  IconRoute,
  IconSettings,
  IconTrash
} from '@tabler/icons-react'
import classNames from 'classnames'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { AutomationCommandIcon } from '../catalog/automation-command-catalog'
import { AutomationStepSettingsDialog } from '../editors/automation-step-dialogs'
import { getStepDraggableId, getStepRowDropId } from '../list/automation-step-drop-target'
import { useAutomationStepsContext } from '../list/automation-steps-context'
import { stepKindLabel, stepSummary, stepTitle } from '../shared/automation-step-utils'
import type { AutomationStepForm } from '../../editor/builder-utils'

export function AutomationStepOutlineRow({
  listId,
  step,
  index,
  canMoveUp,
  canMoveDown,
  onCopy,
  onDuplicate,
  onDelete
}: {
  listId: string
  step: AutomationStepForm
  index: number
  canMoveUp: boolean
  canMoveDown: boolean
  onCopy: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef: setDraggableNodeRef,
    isDragging
  } = useDraggable({
    id: getStepDraggableId(step.clientKey),
    data: { type: 'step', stepId: step.clientKey, listId }
  })
  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: getStepRowDropId(step.clientKey),
    data: { type: 'step-row', stepId: step.clientKey, listId, index }
  })
  const {
    commandByUses,
    selectedStepKey,
    openBlockKeys,
    onSelectStep,
    onToggleBlock,
    onMoveStep,
    onStepChange,
    onSetYamlStepKey
  } = useAutomationStepsContext()
  const [stepSettingsOpen, setStepSettingsOpen] = useState(false)
  const command = step.kind === 'action' ? commandByUses.get(step.uses) : undefined
  const selected = selectedStepKey === step.clientKey
  const isBlock = step.kind !== 'action'
  const open = openBlockKeys.includes(step.clientKey)
  const onMoveUp = () => onMoveStep(listId, step.clientKey, -1)
  const onMoveDown = () => onMoveStep(listId, step.clientKey, 1)
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableNodeRef(node)
      setDroppableNodeRef(node)
    },
    [setDraggableNodeRef, setDroppableNodeRef]
  )

  return (
    <>
      <div
        ref={setNodeRef}
        data-automation-step-item='true'
        className={classNames(
          'group relative grid min-h-14 rounded-md border transition-colors',
          selected
            ? 'border-primary/45 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]'
            : 'border-border/60 bg-surface-panel/45 hover:border-border/80 hover:bg-surface-panel/60',
          isDragging ? 'pointer-events-none opacity-0' : null
        )}
      >
        {selected ? <div className='absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary' /> : null}
        <div className='grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5'>
          <button
            type='button'
            ref={setActivatorNodeRef}
            className='flex size-8 cursor-grab items-center justify-center rounded-md text-foreground-muted hover:bg-secondary/60 active:cursor-grabbing'
            aria-label='Drag step'
            {...attributes}
            {...listeners}
          >
            <IconGripVertical className='size-4' />
          </button>

          <button
            type='button'
            className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md px-1 py-1 text-left'
            onClick={() => onSelectStep(step.clientKey)}
          >
            <span className='flex size-8 shrink-0 items-center justify-center rounded-md bg-background/65 text-primary'>
              {step.kind === 'action' ? (
                <AutomationCommandIcon
                  uses={step.uses}
                  className='size-5'
                />
              ) : (
                <IconRoute className='size-5' />
              )}
            </span>
            <span className='min-w-0'>
              <span className='flex min-w-0 items-center gap-2'>
                <span className='truncate text-sm font-medium'>{stepTitle(step, command)}</span>
                <span className='hidden rounded-sm border border-border/60 px-1.5 py-0.5 text-[0.625rem] uppercase tracking-normal text-foreground-muted sm:inline'>
                  {stepKindLabel(step)}
                </span>
              </span>
              <span className='block truncate text-xs text-foreground-muted'>{stepSummary(step)}</span>
            </span>
          </button>

          <div className='flex items-center gap-0.5'>
            {isBlock ? (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label={open ? 'Collapse block' : 'Expand block'}
                onClick={event => {
                  event.stopPropagation()
                  onToggleBlock(step.clientKey)
                }}
              >
                <IconChevronDown className={classNames('size-4 transition-transform', open ? null : '-rotate-90')} />
              </Button>
            ) : null}
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='Move step up'
              disabled={!canMoveUp}
              className='max-sm:hidden'
              onClick={event => {
                event.stopPropagation()
                onMoveUp()
              }}
            >
              <IconArrowUp className='size-4' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='Move step down'
              disabled={!canMoveDown}
              className='max-sm:hidden'
              onClick={event => {
                event.stopPropagation()
                onMoveDown()
              }}
            >
              <IconArrowDown className='size-4' />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label='Step menu'
                  onClick={event => event.stopPropagation()}
                  onKeyDown={event => event.stopPropagation()}
                >
                  <IconDotsVertical className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='end'
                className='min-w-40 p-2'
              >
                <DropdownMenuItem
                  className='gap-2 px-3 py-2'
                  onSelect={() => setStepSettingsOpen(true)}
                >
                  <IconSettings className='size-4' />
                  Step settings
                </DropdownMenuItem>
                {step.kind === 'action' ? (
                  <DropdownMenuItem
                    className='gap-2 px-3 py-2'
                    onSelect={() => {
                      onSelectStep(step.clientKey)
                      onSetYamlStepKey(step.clientKey)
                    }}
                  >
                    <IconFileCode className='size-4' />
                    Edit YAML
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className='gap-2 px-3 py-2'
                  onSelect={onCopy}
                >
                  <IconCopy className='size-4' />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem
                  className='gap-2 px-3 py-2'
                  onSelect={onDuplicate}
                >
                  <IconCopyCheck className='size-4' />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  className='gap-2 px-3 py-2 text-destructive'
                  onSelect={onDelete}
                >
                  <IconTrash className='size-4' />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <AutomationStepSettingsDialog
        open={stepSettingsOpen}
        step={step}
        onOpenChange={setStepSettingsOpen}
        onApply={stepId => onStepChange(listId, index, { ...step, id: stepId })}
      />
    </>
  )
}
