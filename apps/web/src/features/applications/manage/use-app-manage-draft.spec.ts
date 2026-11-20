import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import {
  buildAppManageUpdateInput,
  getModifiedAppSettings,
  mergeAppConfiguration,
  useAppManageDraft
} from './use-app-manage-draft'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const app = {
  id: 'app_1',
  name: 'Next',
  icon: 'next.png',
  ownerDisplayName: 'Next Owner'
} as AppDefinition

const saved = {
  name: 'Demo',
  customContainerArgs: '',
  inactivityTimeoutSeconds: '60',
  memoryLimitMb: '2048',
  cpuLimitCpus: ''
}
const access = { canChangeContainerArgs: false, canChangeResources: true, canChangeSessionLimit: false }

describe('app manage draft helpers', () => {
  it.each(['saved.png', null])('preserves the saved icon (%s) and owner when applying settings', icon => {
    expect(
      mergeAppConfiguration(app, {
        ...app,
        icon,
        ownerDisplayName: 'Current Owner'
      })
    ).toMatchObject({
      icon,
      ownerDisplayName: 'Current Owner'
    })
  })

  it('builds update input using permission gates', () => {
    const draft = {
      ...saved,
      name: 'Renamed',
      customContainerArgs: '--foo',
      cpuLimitCpus: '2',
      inactivityTimeoutSeconds: '300'
    }
    expect(buildAppManageUpdateInput(draft, getModifiedAppSettings(draft, saved, access))).toEqual({
      name: 'Renamed',
      cpuLimitCpus: 2
    })
  })

  it('clears saved limits while omitting fields that already use the default', () => {
    const draft = { ...saved, memoryLimitMb: '' }
    expect(buildAppManageUpdateInput(draft, getModifiedAppSettings(draft, saved, access))).toEqual({
      memoryLimitMb: null
    })
    expect(
      buildAppManageUpdateInput(draft, getModifiedAppSettings(draft, saved, { ...access, canChangeResources: false }))
    ).toEqual({})
  })

  it('follows a refreshed saved limit after an equivalent numeric edit', () => {
    const { result, rerender } = renderHook(currentApp => useAppManageDraft(currentApp, access), {
      initialProps: { ...previewApp, cpuLimitCpus: 2 }
    })

    act(() => result.current.updateForm({ cpuLimitCpus: '2.0' }))
    expect(result.current.isDirty).toBe(false)
    expect(result.current.draft.cpuLimitCpus).toBe('2.0')

    rerender({ ...previewApp, cpuLimitCpus: 3 })
    expect(result.current.draft.cpuLimitCpus).toBe('3')
    expect(result.current.modified.cpuLimitCpus).toBe(false)
  })
})
