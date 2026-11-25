import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { AppLogsDialog } from './app-logs-dialog'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }))
vi.mock('./use-application-logs', () => ({
  useApplicationLogs: () => ({ source: 'orchestrator', setIsLive: vi.fn() })
}))

const LinkedLogs = ({ app = previewApp }: { app?: typeof previewApp }) => {
  const [open, setOpen] = useState(false)
  return (
    <AppLogsDialog
      app={app}
      open={open}
      onOpenChange={setOpen}
      hideTrigger
    />
  )
}

it('dismisses a linked log dialog and preserves the other query parameters', async () => {
  const original = window.location.href
  try {
    window.history.replaceState(null, '', '/apps/preview-app?logs=1&view=overview')
    const { rerender } = render(<LinkedLogs />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(window.location.search).toBe('?view=overview'))
    rerender(<LinkedLogs app={{ ...previewApp, status: 'running' }} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  } finally {
    window.history.replaceState(null, '', original)
  }
})
