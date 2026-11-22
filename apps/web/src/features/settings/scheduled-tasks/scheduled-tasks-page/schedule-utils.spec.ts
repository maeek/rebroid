import { describe, expect, it } from 'vitest'
import { defaultForm, normalizePayload } from './schedule-utils'

describe('scheduled task payloads', () => {
  it('uses the default retention for each cleanup action until edited', () => {
    const history = defaultForm('clean_workflow_history')
    expect(normalizePayload(history)).toEqual({ retentionDays: 7 })
    expect(normalizePayload({ ...history, payload: { retentionDays: 3 } })).toEqual({ retentionDays: 3 })
    expect(normalizePayload(defaultForm('clean_image_build_history'))).toEqual({ retentionDays: 30 })
    expect(normalizePayload(defaultForm('clean_runtime_logs'))).toEqual({ retentionDays: 30 })
  })

  it('drops unrelated payload fields when changing the action', () => {
    const form = { ...defaultForm('prune_images'), payload: { danglingOnly: false, retentionDays: 7 } }
    expect(normalizePayload(form)).toEqual({ danglingOnly: false })
    expect(normalizePayload({ ...form, actionType: 'prune_networks' })).toBeNull()
  })
})
