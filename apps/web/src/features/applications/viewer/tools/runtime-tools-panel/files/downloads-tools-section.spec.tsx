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
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/runtime/file-actions', () => ({
  createApplicationRuntimeDirectoryAction: vi.fn(),
  deleteApplicationRuntimeFileAction: vi.fn(),
  downloadApplicationRuntimeFileAction: vi.fn(),
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
      const entry = await screen.findByRole('button', { name })
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
