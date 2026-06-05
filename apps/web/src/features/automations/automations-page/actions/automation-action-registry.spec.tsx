import { describe, expect, it } from '@jest/globals'
import { buildYaml, defaultStep } from '../editor/builder-utils'
import {
  getAutomationActionDefinitions,
  getBackendActionInput,
  getDefaultActionInput,
  normalizeActionInput,
  summarizeActionInput
} from './action-registry'

const knownV1Uses = [
  'ai.run',
  'android.wait',
  'android.viewerCommand',
  'android.rotateDisplay',
  'android.tap',
  'android.swipe',
  'android.inputText',
  'android.key',
  'android.setClipboard',
  'android.getClipboard',
  'android.screenshot',
  'android.waitForText',
  'android.tapText',
  'android.adbShell',
  'android.pushFile',
  'android.pullFile',
  'android.deleteFile',
  'android.fileExists',
  'android.listFiles',
  'container.network.allowCidr',
  'container.network.removeAllowedCidr',
  'container.network.clearAllowedCidrs',
  'container.network.blockCidr',
  'container.network.removeBlockedCidr',
  'container.network.clearBlockedCidrs',
  'container.network.setRestrictions',
  'container.network.resetPolicy',
  'assert.textExists',
  'assert.textMissing',
  'assert.fileExists',
  'flow.stop',
  'flow.fail',
  'debug.log',
  'artifact.saveScreenshot'
]

describe('automation action registry', () => {
  it('defines every V1 action explicitly', () => {
    const registeredUses = new Set(getAutomationActionDefinitions().map(definition => definition.uses))

    expect([...registeredUses].sort()).toEqual([...knownV1Uses].sort())
  })

  it('returns backend-compatible defaults for every action', () => {
    for (const uses of knownV1Uses) {
      const input = getDefaultActionInput(uses)

      expect(input).toEqual(expect.any(Object))
      expect(() => getBackendActionInput(uses, input, {})).not.toThrow()
    }
  })

  it('summarizes malformed or empty inputs without throwing', () => {
    for (const uses of knownV1Uses) {
      expect(() => summarizeActionInput(uses, {})).not.toThrow()
      expect(typeof summarizeActionInput(uses, {})).toBe('string')
    }
  })

  it('normalizes imported swipe inputs to backend fields', () => {
    expect(normalizeActionInput('android.swipe', { x1: 'bad', y1: 10 })).toEqual({
      x1: 100,
      y1: 10,
      x2: 100,
      y2: 200,
      durationMs: 300
    })
  })

  it('serializes coordinate actions as absolute backend coordinates', () => {
    expect(
      getBackendActionInput(
        'android.tap',
        { x: 540, y: 960 },
        { coordinateMode: 'percent', xPercent: 50, yPercent: 50 }
      )
    ).toEqual({ x: 540, y: 960 })

    expect(
      getBackendActionInput(
        'android.swipe',
        { x1: 540, y1: 1500, x2: 540, y2: 420, durationMs: 300 },
        {
          coordinateMode: 'percent'
        }
      )
    ).toEqual({ x1: 540, y1: 1500, x2: 540, y2: 420, durationMs: 300 })
  })
})

describe('automation builder serialization', () => {
  it('does not persist UI-only step state in YAML', () => {
    const step = {
      ...defaultStep('android.tap'),
      withJson: JSON.stringify({ x: 540, y: 960 }, null, 2),
      uiState: { coordinateMode: 'percent', xPercent: 50, yPercent: 50 }
    }

    const yaml = buildYaml({
      name: 'Coordinate test',
      description: '',
      tags: [],
      steps: [step]
    })

    expect(yaml).toContain('x: 540')
    expect(yaml).toContain('y: 960')
    expect(yaml).not.toContain('coordinateMode')
    expect(yaml).not.toContain('xPercent')
  })
})
