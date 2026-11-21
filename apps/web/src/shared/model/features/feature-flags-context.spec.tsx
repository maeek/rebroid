import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { FeatureFlagsProvider, useFeatureFlags } from './feature-flags-context'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'

const Preferences = () => {
  const { isFeatureEnabled, isLoading } = useFeatureFlags()
  return (
    <>
      <label>
        Display name <input defaultValue='Operator' />
      </label>
      {isFeatureEnabled('feature.workflows') ? <a href='/automations'>Workflows</a> : null}
      {isLoading ? <span role='status'>Checking features</span> : null}
    </>
  )
}

it('keeps preferences usable and enables feature links when the streamed manifest arrives', async () => {
  const pending = Promise.withResolvers<FeatureFlagManifest | null>()
  const view = render(
    <FeatureFlagsProvider pendingManifest={pending.promise}>
      <Preferences />
    </FeatureFlagsProvider>
  )
  const name = screen.getByRole('textbox', { name: 'Display name' })
  fireEvent.change(name, { target: { value: 'New draft' } })
  expect(screen.queryByRole('link', { name: 'Workflows' })).toBeNull()

  await act(() => {
    pending.resolve({
      revision: 1,
      features: [{ key: 'feature.workflows', enabled: true, supported: true }]
    } as FeatureFlagManifest)
    return pending.promise
  })
  expect(screen.getByRole('link', { name: 'Workflows' })).toBeVisible()
  expect(name).toHaveValue('New draft')

  const refresh = Promise.withResolvers<FeatureFlagManifest | null>()
  view.rerender(
    <FeatureFlagsProvider pendingManifest={refresh.promise}>
      <Preferences />
    </FeatureFlagsProvider>
  )
  await act(() => {
    refresh.resolve(null)
    return refresh.promise
  })
  expect(screen.queryByRole('link', { name: 'Workflows' })).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
  expect(name).toHaveValue('New draft')
})
