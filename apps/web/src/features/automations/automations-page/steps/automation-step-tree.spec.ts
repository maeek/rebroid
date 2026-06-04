import { describe, expect, it } from '@jest/globals'
import { defaultConditionStep, defaultStep, type AutomationConditionStepForm } from '../editor/builder-utils'
import { moveStepByOffset, moveStepToList, ROOT_STEP_LIST_ID } from './automation-step-tree'

const conditionListId = (step: AutomationConditionStepForm, slot: 'then' | 'else') => `${step.clientKey}:${slot}`

describe('automation step tree moves', () => {
  it('moves steps into and out of block lists', () => {
    const wake = defaultStep('android.viewerCommand', 1)
    const condition = defaultConditionStep(2)
    const initial = [wake, condition]

    const movedIntoElse = moveStepToList(initial, wake.clientKey, conditionListId(condition, 'else'), 0)
    const conditionAfterInsert = movedIntoElse[0] as AutomationConditionStepForm

    expect(movedIntoElse).toHaveLength(1)
    expect(conditionAfterInsert.elseSteps).toHaveLength(1)
    expect(conditionAfterInsert.elseSteps[0]?.clientKey).toBe(wake.clientKey)

    const movedOut = moveStepToList(movedIntoElse, wake.clientKey, ROOT_STEP_LIST_ID, 1)

    expect(movedOut).toHaveLength(2)
    expect(movedOut[1]?.clientKey).toBe(wake.clientKey)
    expect((movedOut[0] as AutomationConditionStepForm).elseSteps).toHaveLength(0)
  })

  it('does not move a block into its own descendants', () => {
    const condition = defaultConditionStep(1)
    const initial = [condition]

    expect(moveStepToList(initial, condition.clientKey, conditionListId(condition, 'then'), 0)).toBe(initial)
  })

  it('moves steps up and down within a nested block list', () => {
    const condition = defaultConditionStep(1)
    const first = condition.thenSteps[0]
    const second = defaultStep('debug.log', 2)
    const initial = [{ ...condition, thenSteps: [first, second] }]

    const movedDown = moveStepByOffset(initial, conditionListId(condition, 'then'), first.clientKey, 1)
    const conditionAfterMove = movedDown[0] as AutomationConditionStepForm

    expect(conditionAfterMove.thenSteps.map(step => step.clientKey)).toEqual([second.clientKey, first.clientKey])
  })
})
