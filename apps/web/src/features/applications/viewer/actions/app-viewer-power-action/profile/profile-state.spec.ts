import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { usePowerActionProfileState } from './profile-state'

it('refreshes saved profiles while retaining an open start dialog’s draft', () => {
  const original = {
    ...previewApp,
    profileMode: 'persistent' as const,
    profileName: 'Work',
    savedProfiles: ['Work', 'work', 'Old'].map(name => ({ mode: 'persistent' as const, name }))
  }
  const view = renderHook(({ app, open }) => usePowerActionProfileState(app, open), {
    initialProps: { app: original, open: true }
  })
  act(() => view.result.current.setProfileName('Draft'))
  const updated = { ...original, savedProfiles: original.savedProfiles.slice(0, 2) }
  view.rerender({ app: updated, open: true })
  expect(view.result.current.profileName).toBe('Draft')
  expect(view.result.current.savedProfiles.map(profile => profile.name)).toEqual(['Work', 'work'])
  view.rerender({ app: updated, open: false })
  expect(view.result.current.profileName).toBe('Work')
})
