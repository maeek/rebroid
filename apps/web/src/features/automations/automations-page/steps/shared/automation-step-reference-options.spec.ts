import { describe, expect, it } from 'vitest'
import { defaultConditionStep, defaultRepeatStep, defaultStep, defaultSwitchStep } from '../../editor/builder-utils'
import { collectStepReferenceOptions } from './automation-step-reference-options'

describe('workflow step reference options', () => {
  it('shows prior siblings and accessible parent outputs without leaking other branches', () => {
    const first = { ...defaultStep(), id: 'first' }
    const then = { ...defaultStep(), id: 'then' }
    const inElse = { ...defaultStep(), id: 'else' }
    const after = { ...defaultStep(), id: 'after' }
    const inRepeat = { ...defaultStep(), id: 'in-repeat' }
    const inCase = { ...defaultStep(), id: 'in-case' }
    const inDefault = { ...defaultStep(), id: 'in-default' }
    const condition = { ...defaultConditionStep(), id: 'condition', thenSteps: [then], elseSteps: [inElse] }
    const repeat = { ...defaultRepeatStep(), id: 'repeat', steps: [inRepeat] }
    const choose = {
      ...defaultSwitchStep(),
      id: 'switch',
      cases: [{ clientKey: 'case', value: true, steps: [inCase] }],
      defaultSteps: [inDefault]
    }
    const scopeFor = (clientKey: string) =>
      collectStepReferenceOptions([first, condition, repeat, choose, after], clientKey, new Map()).map(step => step.id)

    expect(scopeFor(inElse.clientKey)).toEqual(['first', 'condition'])
    expect(scopeFor(inRepeat.clientKey)).toEqual(['first', 'condition'])
    expect(scopeFor(inDefault.clientKey)).toEqual(['first', 'condition', 'repeat', 'switch'])
    expect(scopeFor(after.clientKey)).toEqual(['first', 'condition', 'repeat', 'switch'])
  })
})
