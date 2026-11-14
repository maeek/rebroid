import {
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { findStepLocation, getStepMove, type StepLocation } from '../tree/automation-step-tree'
import { getStepIdFromDraggableId } from './automation-step-drop-target'
import type { AutomationStepForm } from '../../editor/builder-utils'

export const resolveStepCollision = (steps: AutomationStepForm[], args: Parameters<CollisionDetection>[0]) => {
  const point = args.pointerCoordinates ?? {
    x: args.collisionRect.left + args.collisionRect.width / 2,
    y: args.collisionRect.top + args.collisionRect.height / 2
  }
  const hits = pointerWithin({ ...args, pointerCoordinates: point })
  let lane: { id: (typeof hits)[number]['id']; listId: string; area: number } | null = null
  for (const hit of hits) {
    const data = args.droppableContainers.find(container => container.id === hit.id)?.data.current
    const rect = args.droppableRects.get(hit.id)
    if (data?.type !== 'step-list' || typeof data.listId !== 'string' || !rect) continue
    const area = rect.width * rect.height
    if (!lane || area < lane.area) lane = { id: hit.id, listId: data.listId, area }
  }
  if (!lane) return []
  const { listId } = lane

  let previous: { stepId: string; midpoint: number } | null = null
  for (const container of args.droppableContainers) {
    const row = container.data.current
    if (row?.type !== 'step-row' || row.listId !== listId || typeof row.stepId !== 'string') continue
    const rect = args.droppableRects.get(container.id)
    if (!rect) continue
    const midpoint = rect.top + rect.height / 2
    if (point.y > midpoint && (!previous || midpoint > previous.midpoint)) {
      previous = { stepId: row.stepId, midpoint }
    }
  }
  const location = previous ? findStepLocation(steps, previous.stepId) : null
  if (previous && location?.listId !== listId) return []

  const stepId: unknown = args.active.data.current?.stepId
  const target = { listId, index: location ? location.index + 1 : 0 }
  if (typeof stepId !== 'string' || !getStepMove(steps, stepId, target)) return []
  return [{ id: lane.id, data: { target } }]
}

export const getStepIdFromDragEvent = (event: DragStartEvent | DragMoveEvent | DragEndEvent) => {
  if (typeof event.active.data.current?.stepId === 'string') return event.active.data.current.stepId
  return getStepIdFromDraggableId(String(event.active.id))
}

export const getAutomationStepDropTarget = (event: DragMoveEvent | DragEndEvent): StepLocation | null => {
  const target: unknown = event.collisions?.[0]?.data?.target
  if (!target || typeof target !== 'object' || !('listId' in target) || !('index' in target)) return null
  if (typeof target.listId !== 'string' || typeof target.index !== 'number') return null
  return { listId: target.listId, index: target.index }
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
