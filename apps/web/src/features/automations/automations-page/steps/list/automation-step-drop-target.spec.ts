import { describe, expect, it } from 'vitest'
import {
  getDropTargetIndex,
  getStepDraggableId,
  getStepIdFromDraggableId,
  getStepListDropId,
  getStepRowDropId
} from './automation-step-drop-target'

describe('automation step drop target', () => {
  it('inserts before the hovered step when dragged above its center', () => {
    expect(getDropTargetIndex(2, { top: 95, height: 40 }, { top: 100, height: 80 })).toBe(2)
  })

  it('inserts after the hovered step when dragged below its center', () => {
    expect(getDropTargetIndex(2, { top: 145, height: 40 }, { top: 100, height: 80 })).toBe(3)
  })

  it('builds explicit drag and drop ids', () => {
    expect(getStepDraggableId('abc')).toBe('step:abc')
    expect(getStepRowDropId('abc')).toBe('row:abc')
    expect(getStepListDropId('root')).toBe('list:root')
    expect(getStepIdFromDraggableId('step:abc')).toBe('abc')
  })
})
