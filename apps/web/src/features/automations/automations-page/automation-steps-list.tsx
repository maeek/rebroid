'use client'

import { useState } from 'react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  IconDotsVertical,
  IconFileCode,
  IconGripVertical,
  IconPlus,
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
import { getActionUiStateFromInput, normalizeActionInput } from './actions/action-registry'
import { AutomationCommandIcon } from './automation-command-catalog'
import { AutomationRawInputDialog, AutomationStepSettingsDialog } from './automation-step-dialogs'
import { AutomationStepEditor } from './automation-step-editor'
import { stepSummary, stepTitle } from './automation-step-utils'
import { defaultStep, type AutomationStepForm } from './builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export function AutomationStepsList({
  steps,
  commands,
  expandedStepKeys,
  onToggleStep,
  onChange,
  onStepChange
}: {
  steps: AutomationStepForm[]
  commands: AutomationCommand[]
  expandedStepKeys: string[]
  onToggleStep: (clientKey: string) => void
  onChange: (steps: AutomationStepForm[]) => void
  onStepChange: (index: number, step: AutomationStepForm) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const commandByUses = new Map(commands.map(command => [command.uses, command]))

  const addStep = () => {
    const step = defaultStep(commands[0]?.uses, steps.length + 1)
    onChange([...steps, step])
    onToggleStep(step.clientKey)
  }

  const duplicateStep = (index: number) => {
    const source = steps[index]
    if (!source) return
    const nextStep = defaultStep(source.uses, steps.length + 1)
    onChange([
      ...steps.slice(0, index + 1),
      {
        ...source,
        clientKey: nextStep.clientKey,
        id: source.id ? `${source.id}-copy` : ''
      },
      ...steps.slice(index + 1)
    ])
  }

  const removeStep = (index: number) => {
    onChange(steps.filter((_, itemIndex) => itemIndex !== index))
  }

  const finishDrag = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const fromIndex = steps.findIndex(step => step.clientKey === active.id)
    const toIndex = steps.findIndex(step => step.clientKey === over.id)
    if (fromIndex === -1 || toIndex === -1) return

    onChange(arrayMove(steps, fromIndex, toIndex))
  }

  return (
    <section className='grid min-w-0 content-start gap-3'>
      <div className='flex h-8 items-center justify-between gap-3'>
        <h3 className='text-xl font-medium'>Steps</h3>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={finishDrag}
      >
        <SortableContext
          items={steps.map(step => step.clientKey)}
          strategy={verticalListSortingStrategy}
        >
          <div className='grid gap-2'>
            {steps.map((step, index) => (
              <AutomationStepRow
                key={step.clientKey}
                step={step}
                command={commandByUses.get(step.uses)}
                commands={commands}
                expanded={expandedStepKeys.includes(step.clientKey)}
                onToggle={() => onToggleStep(step.clientKey)}
                onChange={nextStep => onStepChange(index, nextStep)}
                onDuplicate={() => duplicateStep(index)}
                onDelete={() => removeStep(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        variant='secondary'
        className='h-9'
        onClick={addStep}
      >
        <IconPlus className='size-4' />
        Add step
      </Button>
    </section>
  )
}

function AutomationStepRow({
  step,
  command,
  commands,
  expanded,
  onToggle,
  onChange,
  onDuplicate,
  onDelete
}: {
  step: AutomationStepForm
  command?: AutomationCommand
  commands: AutomationCommand[]
  expanded: boolean
  onToggle: () => void
  onChange: (step: AutomationStepForm) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.clientKey })
  const [stepSettingsOpen, setStepSettingsOpen] = useState(false)
  const [stepRawOpen, setStepRawOpen] = useState(false)

  return (
    <div
      ref={setNodeRef}
      className={classNames(
        'grid rounded-md shadow-[inset_0_0_10px_rgba(0,0,0,0.1)] ring-1 ring-border/50',
        expanded ? 'bg-background/30 text-foreground' : 'bg-background/30 hover:bg-background/45',
        isDragging ? 'z-10 opacity-70 shadow-xl shadow-black/30' : null
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition
      }}
    >
      <div className='grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2'>
        <button
          type='button'
          className='flex size-8 cursor-grab items-center justify-center rounded-md text-secondary-foreground hover:bg-secondary/70 active:cursor-grabbing'
          aria-label='Reorder step'
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
            <AutomationCommandIcon
              uses={step.uses}
              className='size-5'
            />
          </span>
          <span className='min-w-0'>
            <span className='block truncate text-sm font-medium'>{stepTitle(step, command)}</span>
            <span className='block truncate text-xs text-secondary-foreground'>{stepSummary(step)}</span>
          </span>
        </button>

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
            <DropdownMenuItem
              className='gap-2 px-3 py-2'
              onSelect={() => setStepRawOpen(true)}
            >
              <IconFileCode className='size-4' />
              Edit YAML
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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

      <div
        className={classNames(
          'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className='min-h-0'>
          <div className='border-t border-border/50 px-4 pb-4 pt-3 max-sm:px-3'>
            <AutomationStepEditor
              step={step}
              commands={commands}
              boxed={false}
              onChange={onChange}
            />
          </div>
        </div>
      </div>

      <AutomationStepSettingsDialog
        open={stepSettingsOpen}
        step={step}
        onOpenChange={setStepSettingsOpen}
        onApply={stepId => onChange({ ...step, id: stepId })}
      />
      <AutomationRawInputDialog
        open={stepRawOpen}
        step={step}
        onOpenChange={setStepRawOpen}
        onApply={yamlInput => {
          try {
            const normalized = normalizeActionInput(
              step.uses,
              typeof yamlInput === 'object' && yamlInput !== null && !Array.isArray(yamlInput) ? yamlInput : {}
            )
            onChange({
              ...step,
              withJson: JSON.stringify(normalized, null, 2),
              uiState: { ...(step.uiState ?? {}), ...getActionUiStateFromInput(step.uses, normalized) }
            })
          } catch (error) {
            return error instanceof Error ? error.message : 'Invalid step input.'
          }
        }}
      />
    </div>
  )
}
