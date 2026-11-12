import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { actionOk } from '@/shared/actions/action-result'
import { ProviderConnectionFields } from './provider-connection-fields'
import { ProviderConnectionSection } from './provider-edit-form-sections'
import { createProviderDraft, emptyProvider } from './provider-form-model'
import { ProviderNumberField } from './provider-number-field'
import { ProvidersGrid } from './providers-grid'
import { useAiProviderBillingIssues } from './use-ai-provider-billing-issues'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'

describe('AI provider fields', () => {
  it('updates and clears the warning in both views using the local billing snapshot', async () => {
    const provider: AutomationAiProvider = { ...createProviderDraft(), id: 'openai' }
    const issue = { code: 'credit_balance_exhausted', observedAt: '2026-11-12T12:00:00.000Z' }
    const fetch = vi.spyOn(globalThis, 'fetch')
    fetch
      .mockResolvedValueOnce(Response.json(actionOk([], 'initial')))
      .mockResolvedValueOnce(Response.json(actionOk([{ providerId: provider.id, issue }], 'billing-error')))
      .mockRejectedValueOnce(new Error('Temporary local failure'))
      .mockResolvedValueOnce(Response.json(actionOk([], 'recovered')))

    const BillingViews = () => {
      const { issues } = useAiProviderBillingIssues(true)
      return (
        <>
          <ProviderConnectionSection
            provider={provider}
            billingIssue={issues?.get(provider.id)}
            onChange={vi.fn()}
          />
          <ProvidersGrid
            providers={[provider]}
            billingIssues={issues}
            busyId={null}
            selectedIds={new Set()}
            onSelectedIdsChange={vi.fn()}
            onEnableSelected={vi.fn()}
            onDisableSelected={vi.fn()}
            onDeleteSelected={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </>
      )
    }
    const advance = async (ms: number) => {
      await act(() => vi.advanceTimersByTimeAsync(ms))
    }

    vi.useFakeTimers()
    try {
      const queryClient = new QueryClient()
      const view = render(
        <QueryClientProvider client={queryClient}>
          <BillingViews />
        </QueryClientProvider>
      )
      await advance(1)
      expect(screen.queryByRole('alert')).toBeNull()

      await advance(10_000)
      expect(screen.getByRole('alert')).toHaveTextContent('OpenAI credits exhausted')
      expect(screen.getByRole('alert')).toHaveTextContent('2026-11-12 at 12:00:00 UTC')
      expect(screen.getByRole('cell', { name: /OpenAI credits exhausted/ })).toBeInTheDocument()

      await advance(10_000)
      expect(screen.getByRole('alert')).toHaveTextContent('OpenAI credits exhausted')

      await advance(10_000)
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByRole('cell', { name: /OpenAI credits exhausted/ })).toBeNull()
      expect(fetch.mock.calls.map(([url]) => url)).toEqual(
        Array(4).fill('/api/bff/platform/ai-provider-billing-issues')
      )

      view.unmount()
      await advance(10_000)
      expect(fetch).toHaveBeenCalledTimes(4)
    } finally {
      vi.useRealTimers()
      fetch.mockRestore()
    }
  })

  it('connects provider labels and descriptions to their controls', () => {
    const onChange = vi.fn()
    render(
      <ProviderConnectionFields
        provider={emptyProvider()}
        mode='create'
        onChange={onChange}
      />
    )

    const providerId = screen.getByLabelText('Provider ID')
    expect(providerId.getAttribute('id')).toBe('provider-create-id')
    expect(providerId.getAttribute('aria-describedby')).toBe('provider-create-id-description')
    expect(screen.getByRole('combobox', { name: 'Provider' }).getAttribute('id')).toBe('provider-create-kind')

    fireEvent.change(providerId, { target: { value: 'local' } })
    expect(onChange).toHaveBeenCalledWith({ id: 'local' })
  })

  it('shows an editable OpenAI URL and keeps local transport controls out of setup', () => {
    const onChange = vi.fn()
    render(
      <ProviderConnectionFields
        provider={createProviderDraft()}
        mode='create'
        onChange={onChange}
      />
    )

    const url = screen.getByLabelText('Base URL')
    expect(url).toHaveValue('https://api.openai.com/v1')
    fireEvent.change(url, { target: { value: 'https://proxy.example/v1' } })
    expect(onChange).toHaveBeenCalledWith({ baseUrl: 'https://proxy.example/v1' })
    fireEvent.click(screen.getByRole('button', { name: 'Advanced connection settings' }))
    expect(screen.queryByLabelText('Transport protocol')).toBeNull()
  })

  it('supports optional and disabled numeric settings', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ProviderNumberField
        controlId='temperature'
        label='Temperature'
        description='Sampling randomness.'
        value={null}
        disabled
        onChange={onChange}
      />
    )

    const disabledInput = screen.getByLabelText('Temperature')
    expect(disabledInput).toBeDisabled()
    expect(disabledInput).toHaveValue(null)

    rerender(
      <ProviderNumberField
        controlId='temperature'
        label='Temperature'
        description='Sampling randomness.'
        value={0.4}
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
