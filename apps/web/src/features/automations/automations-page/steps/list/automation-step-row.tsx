'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
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
import { AutomationStepBlockEditor } from '../editors/automation-step-block-editor'
import { AutomationStepSettingsDialog } from '../editors/automation-step-dialogs'
import { AutomationStepEditor } from '../editors/automation-step-editor'
import { AutomationStepYamlEditor } from '../editors/automation-step-yaml-editor'
import { collectStepReferenceOptions } from '../shared/automation-step-reference-options'
import { stepSummary, stepTitle } from '../shared/automation-step-utils'
import { ROOT_STEP_LIST_ID } from '../tree/automation-step-tree'
import { getStepDraggableId, getStepRowDropId } from './automation-step-drop-target'
import { useAutomationStepsContext } from './automation-steps-context'
import type { AutomationStepForm } from '../../editor/builder-utils'

export function AutomationStepRow({
  listId,
  step,
  index,
  expanded,
  canMoveUp,
  canMoveDown,
  onCopy,
  onDuplicate,
  onDelete,
  renderNestedSteps
}: {
  listId: string
  step: AutomationStepForm
  index: number
  expanded: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onCopy: () => void
  onDuplicate: () => void
  onDelete: () => void
  renderNestedSteps: (
    nestedSteps: AutomationStepForm[],
    nestedListId: string,
    nestedExpandedStepKeys: string[]
  ) => ReactNode
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
  const { commands, commandByUses, rootSteps, onToggleStep, onStepChange, onMoveStep } = useAutomationStepsContext()
  const [stepSettingsOpen, setStepSettingsOpen] = useState(false)
  const [stepYamlOpen, setStepYamlOpen] = useState(false)
  const command = step.kind === 'action' ? commandByUses.get(step.uses) : undefined
  const stepOptions = useMemo(() => collectStepReferenceOptions(rootSteps, step.clientKey), [rootSteps, step.clientKey])
  const onChange = (nextStep: AutomationStepForm) => onStepChange(listId, index, nextStep)
  const onToggle = listId === ROOT_STEP_LIST_ID ? () => onToggleStep(step.clientKey) : () => undefined
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
    <div
      ref={setNodeRef}
      data-automation-step-item='true'
      className={classNames(
        'grid rounded-md shadow-[inset_0_0_10px_rgba(0,0,0,0.1)] ring-1 ring-border/50',
        expanded ? 'bg-input/30 text-foreground' : 'bg-input/30 hover:bg-input/45',
        isDragging ? 'pointer-events-none opacity-0' : null
      )}
    >
      <div className='grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2'>
        <button
          type='button'
          ref={setActivatorNodeRef}
          className='flex size-8 cursor-grab items-center justify-center rounded-md text-secondary-foreground hover:bg-secondary/70 active:cursor-grabbing'
          aria-label='Drag step'
          {...attributes}
          {...listeners}
        >
          <IconGripVertical className='size-4' />
        </button>

        <button
          type='button'
          className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-left'
          onClick={onToggle}
        >
          <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-background/70 text-primary'>
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
            <span className='block truncate text-sm font-medium'>{stepTitle(step, command)}</span>
            <span className='block truncate text-xs text-secondary-foreground'>{stepSummary(step)}</span>
          </span>
        </button>

        <div className='flex items-center gap-1'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label='Move step up'
            disabled={!canMoveUp}
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
                  onSelect={() => setStepYamlOpen(open => !open)}
                >
                  <IconFileCode className='size-4' />
                  {stepYamlOpen ? 'Edit Visually' : 'Edit YAML'}
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
                className='px-3 py-2'
                onSelect={onDuplicate}
              >
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                className='gap-2 px-3 py-2 text-red-300'
                onSelect={onDelete}
              >
                <IconTrash className='size-4' />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={classNames(
          'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className='min-h-0'>
          <div className='border-t border-border/50 px-4 pb-4 pt-3 max-sm:px-3'>
            {step.kind === 'action' ? (
              stepYamlOpen ? (
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
              <AutomationStepBlockEditor
                step={step}
                stepOptions={stepOptions}
                onChange={onChange}
                renderSteps={(nestedSteps, nestedListId) =>
                  renderNestedSteps(
                    nestedSteps,
                    nestedListId,
                    nestedSteps.map(item => item.clientKey)
                  )
                }
              />
            )}
          </div>
        </div>
      </div>

      <AutomationStepSettingsDialog
        open={stepSettingsOpen}
        step={step}
        onOpenChange={setStepSettingsOpen}
        onApply={stepId => onChange({ ...step, id: stepId })}
      />
    </div>
  )
}
