import {
  closestCenter,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  pointerWithin
} from '@dnd-kit/core'
import { getStepListLength } from '../tree/automation-step-tree'
import { getDropTargetIndex, getStepIdFromDraggableId } from './automation-step-drop-target'
import type { AutomationStepDropTarget } from './automation-steps-context'
import type { AutomationStepForm } from '../../editor/builder-utils'

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

export const pointerAwareStepCollisionDetection: CollisionDetection = args => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return selectStepCollision(args, pointerCollisions)

  return selectStepCollision(args, closestCenter(args))
}

export const getStepIdFromDragEvent = (event: DragStartEvent | DragOverEvent | DragEndEvent) => {
  if (typeof event.active.data.current?.stepId === 'string') return event.active.data.current.stepId

  return getStepIdFromDraggableId(String(event.active.id))
}

export const getStepDropData = (event: DragOverEvent | DragEndEvent): StepDropData | null => {
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

export const getAutomationStepDropTarget = (
  steps: AutomationStepForm[],
  event: DragOverEvent | DragEndEvent
): AutomationStepDropTarget => {
  const activeId = getStepIdFromDragEvent(event)
  const dropData = getStepDropData(event)
  if (!dropData || (dropData.type === 'step-row' && activeId === dropData.stepId)) return null

  if (dropData.type === 'step-list') {
    return { listId: dropData.listId, index: getStepListLength(steps, dropData.listId) }
  }

  return {
    listId: dropData.listId,
    index: getDropTargetIndex(dropData.index, event.active.rect.current.translated, event.over?.rect ?? null)
  }
}

export const isEditablePasteTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLElement && target.isContentEditable) return true
  const editable = target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
  if (!editable) return false
  if (editable instanceof HTMLInputElement) {
    return editable.type !== 'checkbox' && editable.type !== 'radio'
  }
  return true
}
