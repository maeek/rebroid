import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { deleteApplicationProfileAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { actionOk } from '@/shared/actions/action-result'
import { useRemoveApplicationProfile } from './use-remove-application-profile'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const app: AppDefinition = {
  ...previewApp,
  savedProfiles: [
    { mode: 'persistent', name: 'Work' },
    { mode: 'temporary', name: 'Work' },
    { mode: 'persistent', name: 'work' }
  ]
}
const setApp = vi.fn<(update: (current?: AppDefinition) => AppDefinition | undefined) => void>()
vi.mock('@/features/applications/detail/application-viewer-context', () => ({
  useApplicationViewerContext: () => ({ app, setApp })
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions', () => ({
  deleteApplicationProfileAction: vi.fn()
}))

it('removes only the acknowledged profile from the same application snapshot', async () => {
  vi.mocked(deleteApplicationProfileAction).mockResolvedValue(actionOk(undefined))
  const { result } = renderHook(useRemoveApplicationProfile)
  await result.current('Work')
  const [update] = setApp.mock.calls[0]
  const current = { ...app, icon: 'updated-icon' }
  expect(update(current)).toEqual({ ...current, savedProfiles: app.savedProfiles.slice(1) })
  for (const changed of [undefined, { ...app, id: 'next-app' }, { ...app, savedProfiles: [...app.savedProfiles] }]) {
    expect(update(changed)).toBe(changed)
  }
})
