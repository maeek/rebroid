import { describe, expect, it } from 'vitest'
import { defaultConditionStep, defaultRepeatStep, defaultStep, defaultSwitchStep } from '../../editor/builder-utils'
import { moveStepToList, ROOT_STEP_LIST_ID } from '../tree/automation-step-tree'
import { collectStepReferenceIssues } from './automation-step-reference-issues'

const output = (stepId: string) => ({ source: 'stepOutput' as const, stepId, outputKey: 'summary' })
const actionWithReference = (stepId: string) => ({
  ...defaultStep('debug.log'),
  withJson: JSON.stringify({ message: { $ref: output(stepId) } })
})

describe('workflow step reference issues', () => {
  it('identifies the consumer after a reorder and clears the issue when the order is restored', () => {
    const producer = { ...defaultStep('android.wait'), id: 'producer' }
    const consumer = actionWithReference(producer.id)
    const steps = [producer, consumer]
    expect(collectStepReferenceIssues(steps).size).toBe(0)

    const moved = moveStepToList(steps, producer.clientKey, ROOT_STEP_LIST_ID, 2)
    expect(collectStepReferenceIssues(moved).get(consumer.clientKey)?.issues).toEqual([
      { field: 'Source for message', reference: output(producer.id) }
    ])
    expect(collectStepReferenceIssues(moveStepToList(moved, producer.clientKey, ROOT_STEP_LIST_ID, 0)).size).toBe(0)
  })

  it('finds consumers left behind when a producer moves into another branch', () => {
    const producer = { ...defaultStep('android.wait'), id: 'producer' }
    const consumer = actionWithReference(producer.id)
    const condition = { ...defaultConditionStep(), thenSteps: [producer, consumer], elseSteps: [] }
    const steps = [condition]
    expect(collectStepReferenceIssues(steps).size).toBe(0)

    const moved = moveStepToList(steps, producer.clientKey, `${condition.clientKey}:else`, 0)
    expect([...collectStepReferenceIssues(moved).keys()]).toEqual([consumer.clientKey])
  })

  it('reports consumers inside collapsed branches and keeps parent outputs available to condition and switch branches', () => {
    const producer = { ...defaultStep('android.wait'), id: 'producer' }
    const inThen = actionWithReference('gate')
    const inElse = actionWithReference(producer.id)
    const inCase = actionWithReference('choice')
    const condition = { ...defaultConditionStep(), id: 'gate', thenSteps: [producer, inThen], elseSteps: [inElse] }
    const choose = {
      ...defaultSwitchStep(),
      id: 'choice',
      cases: [{ clientKey: 'case', value: true, steps: [inCase] }]
    }

    const issues = collectStepReferenceIssues([condition, choose])
    expect([...issues.keys()]).toEqual([inElse.clientKey])
    expect(issues.get(inElse.clientKey)?.ancestors).toEqual([condition.clientKey])
  })

  it('checks condition values, binary comparisons, switch values and while predicates', () => {
    const value = output('missing-value')
    const compare = output('missing-comparison')
    const expression = {
      groups: [{ conditions: [{ value, compare, operator: 'equals' as const }] }]
    }
    const condition = { ...defaultConditionStep(), id: 'condition', condition: expression }
    const choose = { ...defaultSwitchStep(), id: 'switch', value }
    const repeat = { ...defaultRepeatStep(), id: 'repeat', mode: 'while' as const, while: expression }
    const count = { ...defaultRepeatStep(), id: 'count', mode: 'count' as const, while: expression }
    const unary = {
      ...defaultConditionStep(),
      id: 'unary',
      condition: { groups: [{ conditions: [{ value, compare, operator: 'exists' as const }] }] }
    }

    const issues = collectStepReferenceIssues([condition, choose, repeat, count, unary])
    expect(issues.get(condition.clientKey)?.issues.map(issue => issue.reference)).toEqual([value, compare])
    expect(issues.get(choose.clientKey)?.issues.map(issue => issue.field)).toEqual(['Switch value'])
    expect(issues.get(repeat.clientKey)?.issues.map(issue => issue.reference)).toEqual([value, compare])
    expect(issues.has(count.clientKey)).toBe(false)
    expect(issues.get(unary.clientKey)?.issues.map(issue => issue.reference)).toEqual([value])
  })
})
