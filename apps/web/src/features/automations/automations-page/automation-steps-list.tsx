'use client'

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
import { IconDotsVertical, IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react'
import classNames from 'classnames'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AutomationCommandIcon } from './automation-command-catalog'
import { stepSummary, stepTitle } from './automation-step-utils'
import { defaultStep, type AutomationStepForm } from './builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export function AutomationStepsList({
  steps,
  commands,
  selectedIndex,
  onSelect,
  onChange
}: {
  steps: AutomationStepForm[]
  commands: AutomationCommand[]
  selectedIndex: number
  onSelect: (index: number) => void
  onChange: (steps: AutomationStepForm[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const commandByUses = new Map(commands.map(command => [command.uses, command]))

  const addStep = () => {
    onChange([...steps, defaultStep(commands[0]?.uses, steps.length + 1)])
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
                selected={index === selectedIndex}
                onSelect={() => onSelect(index)}
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
  selected,
  onSelect,
  onDuplicate,
  onDelete
}: {
  step: AutomationStepForm
  command?: AutomationCommand
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.clientKey })

  return (
    <div
      ref={setNodeRef}
      className={classNames(
        'grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2',
        selected ? 'bg-primary/15 text-foreground ring-1 ring-primary/75' : 'bg-card/35 hover:bg-card/50',
        isDragging ? 'z-10 opacity-70 shadow-xl shadow-black/30' : null
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition
      }}
    >
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
        onClick={onSelect}
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
            aria-label='Step actions'
          >
            <IconDotsVertical className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem
            className='text-red-300'
            onSelect={onDelete}
          >
            <IconTrash className='size-4' />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
