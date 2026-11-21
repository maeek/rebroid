import { describe, expect, it } from 'vitest'
import { applicationPreview } from '@/shared/testing/application-preview'
import { mapAndroidApplicationToAppDefinition, mergeApplicationDetailRefresh } from './app-mapper'

describe('application detail refresh', () => {
  const previous = { ...applicationPreview, detailRevision: 'previous.1' }
  const current = mapAndroidApplicationToAppDefinition({ ...previous, name: 'Edited', detailRevision: 'current.1' })

  it('keeps an edit after a full response requested before that revision arrived', () => {
    expect(mergeApplicationDetailRefresh(current, { app: previous, state: null }, 'original.1')).toBe(current)
  })

  it('preserves local metadata when refreshing the current revision', () => {
    const local = { ...current, icon: 'icon', ownerDisplayName: 'Owner' }
    const app = { ...previous, name: 'Latest', detailRevision: 'latest.1' }
    expect(mergeApplicationDetailRefresh(local, { app, state: null }, current.detailRevision)).toMatchObject({
      name: 'Latest',
      icon: 'icon',
      ownerDisplayName: 'Owner'
    })
  })

  it('replaces privileged fields as soon as the server drops backend-detail access', () => {
    const app = {
      ...previous,
      detailRevision: 'previous.0',
      runtime: { ...previous.runtime, containerName: 'Managed container' }
    }
    expect(mergeApplicationDetailRefresh(current, { app, state: null }, previous.detailRevision)).toMatchObject({
      containerName: 'Managed container',
      detailRevision: 'previous.0'
    })
  })
})
