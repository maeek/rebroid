import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { getBff } from '@/lib/http/bff'
import {
  deleteApplicationRuntimeFileAction,
  renameApplicationRuntimeFileAction
} from '@/server/orchestrator/applications/actions/runtime/file-actions'
import { actionOk } from '@/shared/actions/action-result'
import { fullPermissions } from '@/shared/permissions/permissions'
import { applicationPreview } from '@/shared/testing/application-preview'
import { DownloadsToolsSection } from './downloads-tools-section'
import { uploadDownloadFileWithProgress } from './upload-download-file'
import type { ApplicationRuntimeFile, ApplicationRuntimeFileDownload } from '@/shared/contracts/application'

vi.mock('./upload-download-file', () => ({ uploadDownloadFileWithProgress: vi.fn() }))
vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/runtime/file-actions', () => ({
  createApplicationRuntimeDirectoryAction: vi.fn(),
  deleteApplicationRuntimeFileAction: vi.fn(),
  renameApplicationRuntimeFileAction: vi.fn()
}))

const file = (name: string): ApplicationRuntimeFile => ({
  name,
  path: `/data/Download/${name}`,
  type: 'file',
  sizeBytes: 1,
  itemCount: null,
  modifiedAt: null
})

describe('file action focus', () => {
  it('shares a pending download between the row and inspector while other files remain usable', async () => {
    const pending = Promise.withResolvers<ApplicationRuntimeFileDownload>()
    vi.mocked(getBff).mockImplementation((url: string) =>
      url.includes('/files/download?') ? pending.promise : Promise.resolve([file('manual.txt'), file('notes.txt')])
    )
    const app = {
      ...mapAndroidApplicationToAppDefinition(applicationPreview),
      status: 'running' as const,
      running: true
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DownloadsToolsSection
          app={app}
          permissions={fullPermissions}
        />
      </QueryClientProvider>
    )
    const download = await screen.findByRole('button', { name: 'Download manual.txt' })
    fireEvent.click(download)
    expect(download).toBeDisabled()
    expect(within(screen.getByRole('button', { name: 'manual.txt' })).getByText('Preparing download…')).toBeVisible()
    expect(screen.getByText('Preparing download for manual.txt.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Download notes.txt' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'manual.txt' }))
    const details = await screen.findByRole('dialog', { name: 'File details' })
    const inspectorDownload = within(details).getByRole('button', { name: 'Preparing download…' })
    expect(inspectorDownload).toBeDisabled()
    fireEvent.click(inspectorDownload)
    expect(vi.mocked(getBff).mock.calls.filter(([url]) => url.includes('/files/download?'))).toEqual([
      [`/api/bff/devices/${app.id}/runtime/files/download?${new URLSearchParams({ path: file('manual.txt').path })}`]
    ])
    pending.reject(new Error('Download temporarily unavailable'))
    expect(await within(details).findByRole('button', { name: 'Download' })).toBeEnabled()
  })

  it('returns to the renamed row, then the next row or the folder when nothing remains', async () => {
    vi.mocked(getBff).mockResolvedValue([file('a.txt'), file('z.txt')])
    vi.mocked(renameApplicationRuntimeFileAction).mockResolvedValue(actionOk(file('b.txt')))
    vi.mocked(deleteApplicationRuntimeFileAction).mockImplementation((_appId, path) =>
      Promise.resolve(actionOk({ deleted: true, path, type: 'file' }))
    )
    const app = {
      ...mapAndroidApplicationToAppDefinition(applicationPreview),
      status: 'running' as const,
      running: true
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <DownloadsToolsSection
          app={app}
          permissions={fullPermissions}
        />
      </QueryClientProvider>
    )

    const openDetails = async (name: string) => {
      const entry = await screen.findByRole('button', { name }, { timeout: 5_000 })
      entry.focus()
      fireEvent.click(entry)
      return screen.findByRole('dialog', { name: 'File details' })
    }
    const removeFile = async (name: string) => {
      const details = await openDetails(name)
      fireEvent.click(within(details).getByRole('button', { name: 'Delete' }))
      const confirmation = await screen.findByRole('dialog', { name: 'Delete file?' })
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Delete permanently' }))
    }

    const details = await openDetails('a.txt')
    fireEvent.click(within(details).getByRole('button', { name: 'Rename' }))
    const rename = await screen.findByRole('dialog', { name: 'Rename item' })
    fireEvent.change(within(rename).getByRole('textbox', { name: /New name/ }), { target: { value: 'b.txt' } })
    fireEvent.click(within(rename).getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'b.txt' })).toHaveFocus())

    await removeFile('b.txt')
    await waitFor(() => expect(screen.getByRole('button', { name: 'z.txt' })).toHaveFocus())

    await removeFile('z.txt')
    await waitFor(() =>
      expect(within(screen.getByRole('navigation', { name: 'Current folder' })).getByText('Downloads')).toHaveFocus()
    )
  })
})

it('drops queued uploads and aborts active transfers on a device change', async () => {
  const app = { ...mapAndroidApplicationToAppDefinition(applicationPreview), status: 'running' as const }
  vi.mocked(getBff).mockResolvedValue([])
  const pending = Promise.withResolvers<never>()
  const upload = vi.mocked(uploadDownloadFileWithProgress).mockReturnValue(pending.promise)
  const client = new QueryClient()
  const section = (id: string) => (
    <QueryClientProvider client={client}>
      <DownloadsToolsSection
        app={{ ...app, id }}
        permissions={fullPermissions}
      />
    </QueryClientProvider>
  )
  const view = render(section('first-device'))
  fireEvent.drop(screen.getByRole('button', { name: 'Upload files' }), {
    dataTransfer: { types: ['Files'], files: ['a', 'b', 'c'].map(name => new File([''], name)) }
  })
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
  view.rerender(section('second-device'))
  try {
    expect(upload.mock.calls.every(([request]) => request.signal?.aborted)).toBe(true)
  } finally {
    pending.reject(new DOMException('Canceled', 'AbortError'))
  }
  expect(upload.mock.calls.map(([request]) => request.appId)).toEqual(['first-device', 'first-device'])
})

it('loads the new profile listing even while the old listing is fresh', async () => {
  const app = { ...mapAndroidApplicationToAppDefinition(applicationPreview), status: 'running' as const }
  const list = vi.mocked(getBff)
  list.mockResolvedValueOnce([file('old-profile.txt')]).mockResolvedValueOnce([file('new-profile.txt')])
  const client = new QueryClient()
  const section = (profileName: string) => (
    <QueryClientProvider client={client}>
      <DownloadsToolsSection
        app={{ ...app, profileName }}
        permissions={fullPermissions}
      />
    </QueryClientProvider>
  )
  const view = render(section('work'))
  expect(await screen.findByRole('button', { name: 'old-profile.txt' })).toBeVisible()
  view.rerender(section('personal'))
  expect(screen.queryByRole('button', { name: 'old-profile.txt' })).toBeNull()
  expect(await screen.findByRole('button', { name: 'new-profile.txt' })).toBeVisible()
})
