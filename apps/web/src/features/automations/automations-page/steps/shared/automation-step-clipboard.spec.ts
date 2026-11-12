import { describe, expect, it } from 'vitest'
import { cloneAutomationStep } from './automation-step-clipboard'
import { rewriteAutomationStepReferences } from './automation-step-reference-rewrite'
import { parseStepInput } from './automation-step-utils'
import type { AutomationStepForm } from '../../editor/builder-utils'

const actionStep = (id: string, withJson = '{}') => ({
  kind: 'action' as const,
  clientKey: `key-${id}`,
  id,
  uses: 'android.viewerCommand',
  withJson
})

const output = (stepId: string) => ({ source: 'stepOutput' as const, stepId, outputKey: 'summary' })

describe('automation step clipboard', () => {
  it('renames pasted step ids against existing workflow ids', () => {
    const step = actionStep('wake-device')
    const existing = [actionStep('wake-device'), actionStep('wake-device-copy')]

    expect(cloneAutomationStep(step, existing).id).toBe('wake-device-copy-2')
  })

  it('renames nested pasted step ids', () => {
    const step: AutomationStepForm = {
      kind: 'repeat',
      clientKey: 'repeat-key',
      id: 'repeat',
      mode: 'count',
      count: 2,
      while: { groups: [] },
      maxIterations: 2,
      steps: [actionStep('wake-device')]
    }
    const existing = [actionStep('repeat'), actionStep('repeat-copy'), actionStep('wake-device-copy')]
    const next = cloneAutomationStep(step, existing)

    expect(next.id).toBe('repeat-copy-2')
    expect(next.kind === 'repeat' ? next.steps[0]?.id : null).toBe('wake-device-copy-2')
  })

  it('remaps references inside a duplicate and preserves external references with colliding IDs', () => {
    const producer = actionStep('source')
    const consumer = actionStep(
      'consumer',
      JSON.stringify({
        path: { $ref: output('source') },
        contentBase64: { $ref: output('source-copy') }
      })
    )
    const external = actionStep('source-copy')
    const branch: AutomationStepForm = {
      kind: 'condition',
      clientKey: 'branch-key',
      id: 'branch',
      condition: { groups: [{ conditions: [{ value: output('source-copy'), operator: 'exists' }] }] },
      thenSteps: [producer, consumer],
      elseSteps: []
    }
    const clone = cloneAutomationStep(branch, [external, branch])
    if (clone.kind !== 'condition' || clone.thenSteps[1]?.kind !== 'action') throw new Error('Expected a copied branch')
    expect(clone.thenSteps[0]?.id).toBe('source-copy-2')
    expect(parseStepInput(clone.thenSteps[1])).toEqual({
      path: { $ref: output('source-copy-2') },
      contentBase64: { $ref: output('source-copy') }
    })
    expect(clone.condition).toEqual(branch.condition)
    const renamed = rewriteAutomationStepReferences([consumer], new Map([['source', 'renamed']]))[0]
    if (renamed?.kind !== 'action') throw new Error('Expected the consuming step')
    expect(parseStepInput(renamed)).toMatchObject({ path: { $ref: output('renamed') } })
  })
})
