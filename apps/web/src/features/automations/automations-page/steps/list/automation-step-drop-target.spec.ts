import { describe, expect, it } from 'vitest'
import {
  getStepDraggableId,
  getStepIdFromDraggableId,
  getStepListDropId,
  getStepRowDropId
} from './automation-step-drop-target'

describe('automation step drop target', () => {
  it('builds explicit drag and drop ids', () => {
    expect(getStepDraggableId('abc')).toBe('step:abc')
    expect(getStepRowDropId('abc')).toBe('row:abc')
    expect(getStepListDropId('root')).toBe('list:root')
    expect(getStepIdFromDraggableId('step:abc')).toBe('abc')
  })
})
