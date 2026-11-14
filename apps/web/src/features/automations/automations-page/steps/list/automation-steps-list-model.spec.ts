import { describe, expect, it } from 'vitest'
import { defaultConditionStep, defaultStep } from '../../editor/builder-utils'
import { getStepDraggableId } from './automation-step-drop-target'
import { getStepIdFromDragEvent, isEditablePasteTarget, resolveStepCollision } from './automation-steps-list-model'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height
})

const target = (id: string, data: Record<string, string>, bounds: ReturnType<typeof rect>) => ({
  id,
  key: id,
  data: { current: data },
  disabled: false,
  node: { current: null },
  rect: { current: bounds }
})

const source = defaultStep('android.wait', 1)
const block = defaultConditionStep(2)
const last = defaultStep('debug.log', 3)
const steps = [source, block, last]

const dropAt = (x: number, y: number, stepId = source.clientKey) => {
  const branch = block.clientKey + ':else'
  const droppableContainers = [
    target('root', { type: 'step-list', listId: 'root' }, rect(0, 0, 100, 200)),
    target('first', { type: 'step-row', listId: 'root', stepId: source.clientKey }, rect(0, 0, 100, 30)),
    target('middle', { type: 'step-row', listId: 'root', stepId: block.clientKey }, rect(0, 40, 100, 30)),
    target('last', { type: 'step-row', listId: 'root', stepId: last.clientKey }, rect(0, 170, 100, 30)),
    target('branch', { type: 'step-list', listId: branch }, rect(20, 110, 80, 45))
  ]
  const args: Parameters<CollisionDetection>[0] = {
    active: { id: stepId, data: { current: { stepId } }, rect: { current: { initial: null, translated: null } } },
    collisionRect: rect(0, 0, 100, 30),
    droppableRects: new Map(droppableContainers.map(item => [item.id, item.rect.current])),
    droppableContainers,
    pointerCoordinates: { x, y }
  }

  return resolveStepCollision(steps, args)[0]?.data?.target ?? null
}

describe('workflow step drop targets', () => {
  it('cancels releases outside the outline and beside the source', () => {
    expect(dropAt(120, 185)).toBeNull()
    expect(dropAt(30, 12)).toBeNull()
  })

  it('updates the insertion gap across the midpoint of a row and between rows', () => {
    expect(dropAt(30, 175)).toEqual({ listId: 'root', index: 2 })
    expect(dropAt(30, 190)).toEqual({ listId: 'root', index: 3 })
    expect(dropAt(10, 165)).toEqual({ listId: 'root', index: 2 })
  })

  it('chooses the nested lane even when empty and cancels a move into the source block', () => {
    expect(dropAt(30, 130)).toEqual({ listId: block.clientKey + ':else', index: 0 })
    expect(dropAt(30, 130, block.clientKey)).toBeNull()
  })

  it('recognizes the draggable id format when event data is unavailable', () => {
    const active = { id: getStepDraggableId('source'), data: { current: {} } }
    expect(getStepIdFromDragEvent({ active } as DragEndEvent)).toBe('source')
  })

  it('detects editable paste targets without treating checkboxes as text inputs', () => {
    const input = document.createElement('input')
    input.type = 'text'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    const contentEditable = document.createElement('div')
    contentEditable.setAttribute('contenteditable', 'true')
    const button = document.createElement('button')

    expect(isEditablePasteTarget(input)).toBe(true)
    expect(isEditablePasteTarget(checkbox)).toBe(false)
    expect(isEditablePasteTarget(contentEditable)).toBe(true)
    expect(isEditablePasteTarget(button)).toBe(false)
  })
})
