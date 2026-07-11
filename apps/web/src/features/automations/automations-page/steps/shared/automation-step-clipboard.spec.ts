import { describe, expect, it } from 'vitest'
import { makeAutomationStepIdsUnique } from './automation-step-clipboard'
import type { AutomationStepForm } from '../../editor/builder-utils'

const actionStep = (id: string): AutomationStepForm => ({
  kind: 'action',
  clientKey: `key-${id}`,
  id,
  uses: 'android.viewerCommand',
  withJson: '{}'
})

describe('automation step clipboard', () => {
  it('renames pasted step ids against existing workflow ids', () => {
    const step = actionStep('wake-device-copy')
    const existing = [actionStep('wake-device'), actionStep('wake-device-copy')]

    expect(makeAutomationStepIdsUnique(step, existing).id).toBe('wake-device-copy-2')
  })

  it('renames nested pasted step ids', () => {
    const step: AutomationStepForm = {
      kind: 'repeat',
      clientKey: 'repeat-key',
      id: 'repeat-copy',
      mode: 'count',
      count: 2,
      while: { groups: [] },
      maxIterations: 2,
      steps: [actionStep('wake-device-copy')]
    }
    const existing = [actionStep('repeat'), actionStep('repeat-copy'), actionStep('wake-device-copy')]
    const next = makeAutomationStepIdsUnique(step, existing)

    expect(next.id).toBe('repeat-copy-2')
    expect(next.kind === 'repeat' ? next.steps[0]?.id : null).toBe('wake-device-copy-2')
  })
})
