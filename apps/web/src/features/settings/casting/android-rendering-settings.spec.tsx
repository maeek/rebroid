import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { getBff, sendBff } from '@/lib/http/bff'
import { ActionResultError } from '@/shared/actions/action-result'
import { AndroidRenderingSettings } from './android-rendering-settings'
import type { AndroidApplication } from '@/shared/contracts/application'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn(), sendBff: vi.fn() }))

it('requires a device in Host GPU mode and keeps the draft through a failed save', async () => {
  vi.mocked(getBff).mockResolvedValue({ mode: 'software', renderDevice: null })
  vi.mocked(sendBff)
    .mockRejectedValueOnce(
      new ActionResultError({
        message: 'Could not save rendering settings.',
        code: 'upstream_unavailable',
        requestId: 'gpu-save-1'
      })
    )
    .mockResolvedValueOnce({ mode: 'host', renderDevice: '/dev/dri/renderD129' })

  render(
    <QueryClientProvider client={new QueryClient()}>
      <AndroidRenderingSettings applications={[]} />
    </QueryClientProvider>
  )
  expect(await screen.findByText('Software (default)')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Edit rendering' }))
  const mode = await screen.findByRole('combobox', { name: 'Rendering mode' })
  expect(mode).toHaveTextContent('Software (default)')
  expect(screen.queryByRole('textbox', { name: /GPU render device/ })).not.toBeInTheDocument()

  fireEvent.click(mode)
  const host = await screen.findByRole('option', { name: 'Host GPU' })
  fireEvent.pointerDown(host, { pointerType: 'mouse' })
  fireEvent.click(host)
  const device = await screen.findByRole('textbox', { name: /GPU render device/ })
  const save = screen.getByRole('button', { name: 'Save rendering settings' })
  expect(save).toBeDisabled()
  fireEvent.change(device, { target: { value: '/dev/sda' } })
  expect(device).toHaveAttribute('aria-invalid', 'true')
  expect(save).toBeDisabled()

  fireEvent.change(device, { target: { value: '/dev/dri/renderD128' } })
  fireEvent.click(save)
  expect(await screen.findByText(/gpu-save-1/)).toBeVisible()
  expect(device).toHaveValue('/dev/dri/renderD128')

  fireEvent.click(save)
  expect(await screen.findByText('Rendering settings saved')).toBeVisible()
  expect(screen.getByText('/dev/dri/renderD129')).toBeVisible()
  expect(screen.getByText(/Stop and start existing Redroid applications/)).toBeVisible()
})

it('distinguishes pending rendering changes from unknown runtime configuration', async () => {
  vi.mocked(getBff).mockResolvedValue({ mode: 'host', renderDevice: '/dev/dri/renderD128' })
  const applications = [
    { kind: 'redroid', containerId: 'old', appliedRendering: { mode: 'software', renderDevice: null } },
    { kind: 'redroid', containerId: 'legacy', appliedRendering: null },
    { kind: 'generic', containerId: 'generic', appliedRendering: null }
  ].map(runtime => ({ runtime: runtime as AndroidApplication['runtime'] }))
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AndroidRenderingSettings applications={applications} />
    </QueryClientProvider>
  )
  expect(await screen.findByText(/1 differ from the saved setting and 1 have no recorded configuration/)).toBeVisible()
  expect(screen.getByText('Hardware rendering is unverified.')).toBeVisible()
})
