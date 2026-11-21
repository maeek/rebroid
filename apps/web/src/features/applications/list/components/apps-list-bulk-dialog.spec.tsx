import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  requestApplicationDeletionAction,
  requestApplicationStopAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { actionOk } from '@/shared/actions/action-result'
import { toAppGalleryItem } from '@/shared/contracts/application-gallery'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { galleryPreviewApplications } from '../apps-gallery-preview-data'
import { AppsListBulkDialog } from './apps-list-bulk-dialog'
import { AppsListProvider, type BulkAction } from './apps-list-context'
import { useAppsListController } from './use-apps-list-controller'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/hooks/use-polling-query', () => ({ usePollingQuery: () => ({ data: undefined }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions', () => ({
  requestApplicationStartAction: vi.fn(),
  requestApplicationStopAction: vi.fn(),
  requestApplicationDeletionAction: vi.fn()
}))

const apps = ['Alpha', 'Beta', 'Gamma'].map(name => ({
  ...toAppGalleryItem(galleryPreviewApplications[0]),
  id: name,
  name,
  status: 'running' as const,
  lifecycleStage: 'ready' as const,
  running: true
}))

const Fixture = ({ action }: { action: BulkAction }) => {
  const { contextValue } = useAppsListController({
    yourApps: apps,
    canStop: true,
    canDelete: true,
    currentOwnerUserId: 'preview-owner',
    initialSettings: defaultOrchestratorUiSettings
  })
  return (
    <AppsListProvider value={contextValue}>
      <button
        type='button'
        onClick={contextValue.toggleSelectAll}
      >
        Select all
      </button>
      <button
        type='button'
        onClick={() => contextValue.openBulkAction(action)}
      >
        Open confirmation
      </button>
      <output aria-label='Selected IDs'>{[...contextValue.selectedIds].join(', ')}</output>
      <AppsListBulkDialog />
    </AppsListProvider>
  )
}

it.each([
  ['stop', 'Stop'],
  ['delete', 'Delete']
] as const)('keeps confirmed targets and reports each %s request as it settles', async (action, verb) => {
  const accepted = Promise.withResolvers<void>()
  const failed = Promise.withResolvers<void>()
  const last = Promise.withResolvers<void>()
  const requests = new Map([
    ['Alpha', accepted.promise],
    ['Beta', failed.promise],
    ['Gamma', last.promise]
  ])
  vi.mocked(requestApplicationStopAction).mockImplementation(async id => {
    await requests.get(id)
    return actionOk({ status: 'running', lifecycleStage: 'stopping', message: null })
  })
  vi.mocked(requestApplicationDeletionAction).mockImplementation(async id => {
    await requests.get(id)
    return actionOk({ id, deleted: false, cleanupQueued: true, removedData: false })
  })
  render(<Fixture action={action} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
  fireEvent.click(screen.getByRole('button', { name: 'Open confirmation' }))
  const dialog = await screen.findByRole('dialog', { name: `${verb} 3 selected apps?` })
  fireEvent.click(within(dialog).getByRole('button', { name: `${verb} apps` }))
  expect(dialog).toHaveAccessibleName(`${verb} 3 selected apps?`)
  expect(within(dialog).getByText('Alpha, Beta, Gamma')).toBeInTheDocument()
  expect(within(dialog).getByRole('status')).toHaveTextContent('0 accepted · 3 pending · 0 failed')

  await act(() => {
    accepted.resolve()
    failed.reject(new Error('Unavailable'))
    return Promise.allSettled([accepted.promise, failed.promise])
  })
  expect(within(dialog).getByRole('status')).toHaveTextContent('1 accepted · 1 pending · 1 failed')
  const request = action === 'stop' ? requestApplicationStopAction : requestApplicationDeletionAction
  expect(request).toHaveBeenCalledTimes(3)

  await act(() => {
    last.resolve()
    return last.promise
  })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByLabelText('Selected IDs')).toHaveTextContent('Beta')
})
