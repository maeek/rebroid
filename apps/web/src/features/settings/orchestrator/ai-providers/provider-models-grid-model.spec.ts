import { describe, expect, it } from 'vitest'
import {
  findProviderModelSettingsRow,
  nextProviderModelRoles,
  selectedProviderModelIndexes
} from './provider-models-grid-model'
import type { ProviderModelRow } from '@rebroid/ai-core/provider'

const modelRow = (override: Partial<ProviderModelRow>): ProviderModelRow => ({
  rowId: 'row-1',
  index: 0,
  id: 'qwen',
  label: 'Qwen',
  roles: ['planner'],
  settings: {},
  enabled: true,
  defaultFor: [],
  ...override
})

describe('provider models grid model', () => {
  it('maps selected row ids to provider model indexes in row order', () => {
    expect(
      selectedProviderModelIndexes(
        [
          modelRow({ rowId: 'row-a', index: 2 }),
          modelRow({ rowId: 'row-b', index: 4 }),
          modelRow({ rowId: 'row-c', index: 8 })
        ],
        new Set(['row-c', 'row-a'])
      )
    ).toEqual([2, 8])
  })

  it('finds the settings row by row id', () => {
    const rows = [modelRow({ rowId: 'row-a' }), modelRow({ rowId: 'row-b', id: 'llama' })]

    expect(findProviderModelSettingsRow(rows, 'row-b')?.id).toBe('llama')
    expect(findProviderModelSettingsRow(rows, null)).toBeNull()
    expect(findProviderModelSettingsRow(rows, 'missing')).toBeNull()
  })

  it('adds and removes model roles without duplicating existing roles', () => {
    expect(nextProviderModelRoles(['planner'], 'vision', true)).toEqual(['planner', 'vision'])
    expect(nextProviderModelRoles(['planner', 'vision'], 'vision', true)).toEqual(['planner', 'vision'])
    expect(nextProviderModelRoles(['planner', 'vision'], 'planner', false)).toEqual(['vision'])
    expect(nextProviderModelRoles(undefined, 'planner', true)).toEqual(['planner'])
  })
})
