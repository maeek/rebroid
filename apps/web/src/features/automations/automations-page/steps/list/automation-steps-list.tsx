'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { isAutomationStepForm } from '../shared/automation-step-clipboard'
import {
  findStepById,
  getStepListLength,
  moveStepByOffset,
  moveStepToList,
  replaceStepInList,
  ROOT_STEP_LIST_ID,
  updateStepList
} from '../tree/automation-step-tree'
import { AutomationStepDragPreview } from './automation-step-drag-preview'
import { getDropTargetIndex, getStepIdFromDraggableId } from './automation-step-drop-target'
import { AutomationStepListView } from './automation-step-list-view'
import { AutomationStepsProvider, type AutomationStepDropTarget } from './automation-steps-context'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

type StepRowDropData = {
  type: 'step-row'
  stepId: string
  listId: string
  index: number
}

type StepListDropData = {
  type: 'step-list'
  listId: string
}

type StepDropData = StepRowDropData | StepListDropData

const collisionArea = (args: Parameters<CollisionDetection>[0], collision: Collision) => {
  const rect = args.droppableRects.get(collision.id)
  return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY
}

const getCollisionContainerType = (args: Parameters<CollisionDetection>[0], collision: Collision) => {
  const data = args.droppableContainers.find(container => container.id === collision.id)?.data.current
  return typeof data?.type === 'string' ? data.type : null
}

const selectStepCollision = (args: Parameters<CollisionDetection>[0], collisions: Collision[]) => {
  const sortByArea = (left: Collision, right: Collision) => collisionArea(args, left) - collisionArea(args, right)
  const stepCollision = collisions
    .filter(collision => {
      const type = getCollisionContainerType(args, collision)
      return type === 'step-row' || type === 'step-list'
    })
    .sort(sortByArea)[0]

  return stepCollision ? [stepCollision] : collisions
}

const pointerAwareCollisionDetection: CollisionDetection = args => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return selectStepCollision(args, pointerCollisions)

  return selectStepCollision(args, closestCenter(args))
}

const getStepIdFromDragEvent = (event: DragStartEvent | DragOverEvent | DragEndEvent) => {
  if (typeof event.active.data.current?.stepId === 'string') return event.active.data.current.stepId

  return getStepIdFromDraggableId(String(event.active.id))
}

const getStepDropData = (event: DragOverEvent | DragEndEvent): StepDropData | null => {
  const data = event.over?.data.current
  if (data?.type === 'step-row' && typeof data.stepId === 'string' && typeof data.listId === 'string') {
    return {
      type: 'step-row',
      stepId: data.stepId,
      listId: data.listId,
      index: typeof data.index === 'number' ? data.index : 0
    }
  }
  if (data?.type === 'step-list' && typeof data.listId === 'string') {
    return { type: 'step-list', listId: data.listId }
  }
  return null
}

export function AutomationStepsList({
  steps,
  commands,
  expandedStepKeys,
  onToggleStep,
  onChange,
  onStepChange,
  className
}: {
  steps: AutomationStepForm[]
  commands: AutomationCommand[]
  expandedStepKeys: string[]
  onToggleStep: (clientKey: string) => void
  onChange: (steps: AutomationStepForm[]) => void
  onStepChange: (index: number, step: AutomationStepForm) => void
  className?: string
}) {
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<AutomationStepDropTarget>(null)
  const safeSteps = useMemo(() => steps.filter(isAutomationStepForm), [steps])
  const hasInvalidSteps = safeSteps.length !== steps.length
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const commandByUses = useMemo(() => new Map(commands.map(command => [command.uses, command])), [commands])
  const activeStep = activeStepId ? findStepById(safeSteps, activeStepId) : null
  const activeCommand = activeStep?.kind === 'action' ? commandByUses.get(activeStep.uses) : undefined

  const getDropTarget = (event: DragOverEvent | DragEndEvent): AutomationStepDropTarget => {
    const activeId = getStepIdFromDragEvent(event)
    const dropData = getStepDropData(event)
    if (!dropData || (dropData.type === 'step-row' && activeId === dropData.stepId)) return null

    if (dropData.type === 'step-list') {
      return { listId: dropData.listId, index: getStepListLength(safeSteps, dropData.listId) }
    }

    return {
      listId: dropData.listId,
      index: getDropTargetIndex(dropData.index, event.active.rect.current.translated, event.over?.rect ?? null)
    }
  }

  const finishDrag = (event: DragEndEvent) => {
    setActiveStepId(null)
    setDropTarget(null)
    const activeId = getStepIdFromDragEvent(event)
    const target = getDropTarget(event)
    if (!target) return

    onChange(moveStepToList(safeSteps, activeId, target.listId, target.index))
  }

  const updateList = useCallback(
    (listId: string, nextSteps: AutomationStepForm[]) => {
      onChange(updateStepList(safeSteps, listId, () => nextSteps))
    },
    [onChange, safeSteps]
  )

  const updateStep = useCallback(
    (listId: string, index: number, nextStep: AutomationStepForm) => {
      if (listId === ROOT_STEP_LIST_ID) onStepChange(index, nextStep)
      else onChange(replaceStepInList(safeSteps, listId, index, nextStep))
    },
    [onChange, onStepChange, safeSteps]
  )

  const moveStep = useCallback(
    (listId: string, stepId: string, offset: -1 | 1) => {
      onChange(moveStepByOffset(safeSteps, listId, stepId, offset))
    },
    [onChange, safeSteps]
  )

  const stepsContext = useMemo(
    () => ({
      rootSteps: safeSteps,
      commands,
      commandByUses,
      expandedStepKeys,
      dropTarget,
      onToggleStep,
      onListChange: updateList,
      onStepChange: updateStep,
      onMoveStep: moveStep
    }),
    [safeSteps, commands, commandByUses, expandedStepKeys, dropTarget, onToggleStep, updateList, updateStep, moveStep]
  )

  return (
    <div className={className}>
      <DndContext
        id='automation-steps'
        sensors={sensors}
        collisionDetection={pointerAwareCollisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={(event: DragStartEvent) => {
          setActiveStepId(getStepIdFromDragEvent(event))
          setDropTarget(null)
        }}
        onDragOver={(event: DragOverEvent) => setDropTarget(getDropTarget(event))}
        onDragCancel={() => {
          setActiveStepId(null)
          setDropTarget(null)
        }}
        onDragEnd={finishDrag}
      >
        <AutomationStepsProvider value={stepsContext}>
          <AutomationStepListView
            listId={ROOT_STEP_LIST_ID}
            steps={safeSteps}
          />
          {hasInvalidSteps ? (
            <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              Some invalid steps were hidden to keep the visual editor stable. Fix the YAML before saving.
            </div>
          ) : null}
          <DragOverlay
            adjustScale={false}
            dropAnimation={null}
          >
            {activeStep ? (
              <AutomationStepDragPreview
                step={activeStep}
                command={activeCommand}
              />
            ) : null}
          </DragOverlay>
        </AutomationStepsProvider>
      </DndContext>
    </div>
  )
}
