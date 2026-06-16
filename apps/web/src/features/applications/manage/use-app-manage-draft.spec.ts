import { describe, expect, it } from '@jest/globals'
import { buildAppManageUpdateInput, mergeAppPreservingDraftAssets } from './use-app-manage-draft'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const app = {
  id: 'app_1',
  name: 'Next',
  icon: 'next.png',
  ownerDisplayName: 'Next Owner'
} as AppDefinition

describe('app manage draft helpers', () => {
  it('preserves dirty icon and owner display fields across polling merges', () => {
    expect(
      mergeAppPreservingDraftAssets(app, {
        ...app,
        icon: 'dirty.png',
        ownerDisplayName: 'Current Owner'
      })
    ).toMatchObject({
      icon: 'dirty.png',
      ownerDisplayName: 'Current Owner'
    })
  })

  it('builds update input using permission gates', () => {
    expect(
      buildAppManageUpdateInput({
        canChangeContainerArgs: false,
        canChangeResources: true,
        canChangeSessionLimit: false,
        draft: {
          appName: 'Demo',
          containerArgs: '  --foo  ',
          cpuLimitCpus: '2',
          icon: null,
          inactivityTimeoutSeconds: 60,
          memoryLimitMb: '2048'
        }
      })
    ).toEqual({
      name: 'Demo',
      inactivityTimeoutSeconds: undefined,
      memoryLimitMb: 2048,
      cpuLimitCpus: 2,
      containerArgs: undefined
    })
  })
})
