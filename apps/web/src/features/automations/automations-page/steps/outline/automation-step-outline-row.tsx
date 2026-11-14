'use client'

import { useCallback, useContext, useId, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconCopyCheck,
  IconDotsVertical,
  IconFileCode,
  IconGripVertical,
  IconRoute,
  IconSettings,
  IconTrash
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DisclosureChevron } from '@/components/ui/disclosure'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { FormLoadingContext } from '@/components/ui/form-loading-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AutomationCommandIcon } from '../catalog/automation-command-catalog'
import { AutomationStepSettingsDialog } from '../editors/automation-step-dialogs'
import { getStepDraggableId, getStepRowDropId } from '../list/automation-step-drop-target'
import { useAutomationStepsContext } from '../list/automation-steps-context'
import { stepSummary, stepTitle } from '../shared/automation-step-utils'
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
    data: { type: 'step-row', stepId: step.clientKey, listId }
  })
  const {
    commandByUses,
    selectedStepKey,
    openBlockKeys,
    referenceIssues,
    onSelectStep,
    onToggleBlock,
    onMoveStep,
    onStepChange,
    onSetYamlStepKey
  } = useAutomationStepsContext()
  // Close the menu and release page isolation before moving its trigger.
  const pendingMenuMove = useRef<-1 | 1 | null>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const loading = useContext(FormLoadingContext)
  const referenceWarningId = useId()
  const hasBrokenReferences = !loading && referenceIssues?.has(step.clientKey)
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
        data-reorder-id={step.clientKey}
        data-automation-step-item='true'
        className={cn(
          'group relative grid min-h-14 scroll-mt-[calc(var(--workflow-toolbar-bottom,0px)+0.5rem)] rounded-control transition-colors',
          selected && !loading ? 'bg-primary/10' : 'bg-control/25 hover:bg-control-hover/50',
          isDragging ? 'pointer-events-none opacity-0' : null
        )}
      >
        <div className='grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5'>
          <button
            type='button'
            ref={setActivatorNodeRef}
            className='flex size-8 touch-none cursor-grab items-center justify-center rounded-control text-foreground-muted hover:bg-surface-band/60 active:cursor-grabbing'
            data-reorder-focus='drag'
            aria-label='Drag step'
            {...attributes}
            {...listeners}
          >
            <IconGripVertical className='size-4' />
          </button>

          <button
            type='button'
            className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-control px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            data-reorder-focus='select'
            data-step-select={step.clientKey}
            aria-pressed={selected}
            aria-describedby={hasBrokenReferences ? referenceWarningId : undefined}
            aria-label={`Edit step ${index + 1}: ${stepTitle(step, command)}`}
            onClick={() => onSelectStep(step.clientKey)}
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-control bg-background/65',
                loading ? 'text-foreground-muted' : 'text-primary'
              )}
            >
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
                <span className='truncate text-sm font-medium'>
                  {loading ? <Skeleton className='h-4 w-32 max-w-full' /> : stepTitle(step, command)}
                </span>
              </span>
              <span className='line-clamp-2 text-xs text-foreground-muted [overflow-wrap:anywhere]'>
                {loading ? <Skeleton className='h-3 w-40 max-w-full' /> : stepSummary(step)}
              </span>
              {hasBrokenReferences ? (
                <span
                  id={referenceWarningId}
                  className='flex items-center gap-1 text-xs font-medium text-warning'
                >
                  <IconAlertTriangle
                    aria-hidden='true'
                    className='size-3.5 shrink-0'
                  />
                  Broken reference
                </span>
              ) : null}
            </span>
          </button>

          <div className='flex items-center gap-0.5'>
            {isBlock ? (
              <Button
                type='button'
                variant='ghost'
                size='icon-md'
                aria-expanded={open}
                aria-label={open ? 'Collapse block' : 'Expand block'}
                onClick={event => {
                  event.stopPropagation()
                  onToggleBlock(step.clientKey)
                }}
              >
                <DisclosureChevron
                  open={open}
                  direction='right'
                  className='size-4'
                />
              </Button>
            ) : null}
            <Button
              type='button'
              variant='ghost'
              size='icon-md'
              data-reorder-focus='up'
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
              size='icon-md'
              data-reorder-focus='down'
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
            <DropdownMenu
              onOpenChangeComplete={isOpen => {
                if (isOpen || pendingMenuMove.current === null) return
                const offset = pendingMenuMove.current
                pendingMenuMove.current = null
                onMoveStep(listId, step.clientKey, offset)
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon-md'
                  ref={menuTriggerRef}
                  data-reorder-focus='menu'
                  aria-label='Step menu'
                  onClick={event => event.stopPropagation()}
                  onKeyDown={event => event.stopPropagation()}
                >
                  <IconDotsVertical className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                finalFocus={menuTriggerRef}
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
                <DropdownMenuItem
                  className='gap-2 px-3 py-2 sm:hidden'
                  disabled={!canMoveUp}
                  onSelect={() => {
                    pendingMenuMove.current = -1
                  }}
                >
                  <IconArrowUp className='size-4' />
                  Move step up
                </DropdownMenuItem>
                <DropdownMenuItem
                  className='gap-2 px-3 py-2 sm:hidden'
                  disabled={!canMoveDown}
                  onSelect={() => {
                    pendingMenuMove.current = 1
                  }}
                >
                  <IconArrowDown className='size-4' />
                  Move step down
                </DropdownMenuItem>
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
                  className='gap-2 px-3 py-2 text-danger'
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
