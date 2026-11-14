import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PlatformPageRefreshButton } from './platform-page-refresh-button'

afterEach(() => vi.useRealTimers())

const Harness = () => {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState({ version: 0, succeeded: true })
  return (
    <>
      <PlatformPageRefreshButton
        isRefreshing={pending}
        refreshResult={result}
        onRefresh={() => setPending(true)}
      />
      <button
        onClick={() => {
          setResult(previous => ({ version: previous.version + 1, succeeded: true }))
          setPending(false)
        }}
      >
        Complete
      </button>
      <button
        onClick={() => {
          setResult(previous => ({ version: previous.version + 1, succeeded: false }))
          setPending(false)
        }}
      >
        Fail
      </button>
      <button onClick={() => setPending(false)}>Finish with stale data</button>
    </>
  )
}

it('confirms a requested fresh result, expires quietly, and ignores background updates', async () => {
  vi.useFakeTimers()
  render(<Harness />)
  const refresh = screen.getByRole('button', { name: 'Refresh' })
  fireEvent.click(screen.getByRole('button', { name: 'Complete' }))
  expect(screen.queryByText('Updated')).toBeNull()
  fireEvent.click(refresh)
  expect(refresh).toBeDisabled()
  expect(refresh).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Complete' }))
  expect(screen.getByText('Updated')).toBeInTheDocument()
  expect(refresh).toBeEnabled()
  expect(refresh).toHaveAccessibleName('Refresh')
  await act(() => vi.advanceTimersByTime(1200))
  expect(screen.queryByText('Updated')).toBeNull()
})

it('does not confirm errors or stale data and can retry', () => {
  render(<Harness />)
  const refresh = screen.getByRole('button', { name: 'Refresh' })
  for (const completion of ['Fail', 'Finish with stale data']) {
    fireEvent.click(refresh)
    fireEvent.click(screen.getByRole('button', { name: completion }))
    expect(screen.queryByText('Updated')).toBeNull()
    expect(refresh).toBeEnabled()
  }
  fireEvent.click(refresh)
  fireEvent.click(screen.getByRole('button', { name: 'Complete' }))
  expect(screen.getByText('Updated')).toBeInTheDocument()
  fireEvent.click(refresh)
  expect(screen.queryByText('Updated')).toBeNull()
})
