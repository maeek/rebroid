import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import { stopPlatformContainerAction } from '@/server/orchestrator/platform/container-actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { useRuntimeContainerActions } from './use-runtime-container-actions'
import type { PlatformContainer } from '@/shared/contracts/platform'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/platform/container-actions', () => ({ stopPlatformContainerAction: vi.fn() }))

it('leaves failed containers selected and retries only those containers', async () => {
  const containers = ['stopped', 'conflict', 'offline'].map(id => ({ id, state: 'running' }) as PlatformContainer)
  const stop = vi.mocked(stopPlatformContainerAction)
  stop
    .mockResolvedValueOnce(actionOk({ id: 'stopped', stopped: true }))
    .mockResolvedValueOnce(actionError({ message: 'Container is busy', code: 'conflict' }))
    .mockRejectedValueOnce(new Error('Could not reach the server'))
    .mockResolvedValue(actionOk({ id: 'retried', stopped: true }))

  const selected = new Set(containers.map(container => container.id))
  const deselectItems = (ids: ReadonlySet<string>) => ids.forEach(id => selected.delete(id))
  const refresh = vi.fn()
  const { result, rerender } = renderHook(
    ({ selectedContainers }) => useRuntimeContainerActions({ selectedContainers, deselectItems, refresh }),
    { initialProps: { selectedContainers: containers } }
  )
  await act(() => result.current.runBulkAction('stop'))
  expect([...selected]).toEqual(['conflict', 'offline'])
  expect(toast).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      description: '1 succeeded, 2 failed. Container is busy',
      variant: 'danger'
    })
  )

  rerender({ selectedContainers: containers.filter(container => selected.has(container.id)) })
  await act(() => result.current.runBulkAction('stop'))
  expect(stop.mock.calls.map(([id]) => id)).toEqual(['stopped', 'conflict', 'offline', 'conflict', 'offline'])
  expect(selected.size).toBe(0)
})
