import { describe, expect, it } from '@jest/globals'
import { defaultConditionStep, defaultStep } from '../../editor/builder-utils'
import { collectBlockKeys, collectStepKeys, firstStepKey, selectionAfterDelete } from './automation-step-selection'

describe('automation step selection helpers', () => {
  it('collects root and nested step keys in visible workflow order', () => {
    const rootAction = defaultStep('android.wait', 1, 'root-action')
    const nestedAction = defaultStep('debug.log', 1, 'nested-action')
    const condition = {
      ...defaultConditionStep(2, 'condition-block'),
      thenSteps: [nestedAction],
      elseSteps: []
    }

    expect(collectStepKeys([rootAction, condition])).toEqual(['root-action', 'condition-block', 'nested-action'])
    expect(firstStepKey([rootAction, condition])).toBe('root-action')
    expect(collectBlockKeys([rootAction, condition])).toEqual(['condition-block'])
  })

  it('selects the nearest sibling after deleting a step', () => {
    const first = defaultStep('android.wait', 1, 'first')
    const second = defaultStep('android.wait', 2, 'second')
    const third = defaultStep('android.wait', 3, 'third')

    expect(selectionAfterDelete([first, second, third], 1)).toBe('third')
    expect(selectionAfterDelete([first, second, third], 2)).toBe('second')
    expect(selectionAfterDelete([first], 0)).toBeNull()
  })
})
