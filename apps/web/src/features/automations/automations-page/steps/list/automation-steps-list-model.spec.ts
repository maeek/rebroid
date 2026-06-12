import { describe, expect, it } from '@jest/globals'
import { getStepDraggableId } from './automation-step-drop-target'
import {
  getAutomationStepDropTarget,
  getStepDropData,
  getStepIdFromDragEvent,
  isEditablePasteTarget
} from './automation-steps-list-model'
import type { DragEndEvent } from '@dnd-kit/core'

const dragEvent = ({
  activeData = {},
  activeId = getStepDraggableId('dragged-step'),
  overData,
  activeTop = 0,
  overTop = 0
}: {
  activeData?: Record<string, unknown>
  activeId?: string
  overData?: Record<string, unknown>
  activeTop?: number
  overTop?: number
}): DragEndEvent =>
  ({
    active: {
      id: activeId,
      data: { current: activeData },
      rect: {
        current: {
          translated: { top: activeTop, height: 20 }
        }
      }
    },
    over: overData
      ? {
          id: 'over',
          data: { current: overData },
          rect: { top: overTop, height: 20 }
        }
      : null
  }) as DragEndEvent

describe('automation steps list model', () => {
  it('reads the dragged step id from active data before the draggable id', () => {
    expect(getStepIdFromDragEvent(dragEvent({ activeData: { stepId: 'from-data' } }))).toBe('from-data')
    expect(getStepIdFromDragEvent(dragEvent({ activeId: getStepDraggableId('from-id') }))).toBe('from-id')
  })

  it('normalizes supported drop data shapes', () => {
    expect(
      getStepDropData(
        dragEvent({
          overData: { type: 'step-row', stepId: 'target-step', listId: 'root', index: 2 }
        })
      )
    ).toEqual({ type: 'step-row', stepId: 'target-step', listId: 'root', index: 2 })
    expect(getStepDropData(dragEvent({ overData: { type: 'step-list', listId: 'root' } }))).toEqual({
      type: 'step-list',
      listId: 'root'
    })
    expect(getStepDropData(dragEvent({ overData: { type: 'unknown' } }))).toBeNull()
  })

  it('derives row and list drop targets while rejecting self-drops', () => {
    expect(
      getAutomationStepDropTarget(
        [],
        dragEvent({
          activeData: { stepId: 'dragged-step' },
          overData: { type: 'step-row', stepId: 'target-step', listId: 'root', index: 1 },
          activeTop: 30,
          overTop: 0
        })
      )
    ).toEqual({ listId: 'root', index: 2 })

    expect(getAutomationStepDropTarget([], dragEvent({ overData: { type: 'step-list', listId: 'root' } }))).toEqual({
      listId: 'root',
      index: 0
    })

    expect(
      getAutomationStepDropTarget(
        [],
        dragEvent({
          activeData: { stepId: 'same-step' },
          overData: { type: 'step-row', stepId: 'same-step', listId: 'root', index: 0 }
        })
      )
    ).toBeNull()
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
