import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as actions from '@/server/orchestrator/settings/actions'
import { ProviderHealthBadge } from './provider-health-badge'
import type { AutomationAiProvider, AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

vi.mock('@/server/orchestrator/settings/actions', () => ({
  checkAutomationAiProviderHealthAction: vi.fn()
}))

const provider = (id: string): AutomationAiProvider =>
  ({
    id,
    label: 'Local',
    kind: 'ollama',
    protocol: 'openai-chat-completions',
    serverFlavor: 'auto',
    baseUrl: 'http://localhost:11434',
    apiKey: null,
    enabled: true,
    models: [
      {
        id: 'qwen',
        label: 'Qwen',
        enabled: true,
        defaultFor: ['planner'],
        roles: ['planner'],
        settings: {}
      }
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }) as AutomationAiProvider

const okHealth = (providerId: string): AutomationAiProviderHealth => ({
  providerId,
  modelId: 'qwen',
  status: 'ok',
  message: 'Healthy',
  checkedAt: '2026-01-01T00:00:00.000Z'
})

describe('ProviderHealthBadge', () => {
  beforeEach(() => {
    vi.mocked(actions.checkAutomationAiProviderHealthAction).mockReset()
  })

  it('does not check provider health automatically by default', () => {
    const providerId = `provider_${crypto.randomUUID()}`

    render(
      <ProviderHealthBadge
        provider={provider(providerId)}
        modelId='qwen'
      />
    )

    expect(screen.getByText('Unknown')).toBeTruthy()
    expect(actions.checkAutomationAiProviderHealthAction).not.toHaveBeenCalled()
  })

  it('keeps the previous health label while refreshing a known provider/model', async () => {
    const providerId = `provider_${crypto.randomUUID()}`
    vi.mocked(actions.checkAutomationAiProviderHealthAction).mockResolvedValueOnce(okHealth(providerId))

    const { unmount } = render(
      <ProviderHealthBadge
        provider={provider(providerId)}
        modelId='qwen'
        autoCheck
      />
    )

    expect(await screen.findByText('Online')).toBeTruthy()
    unmount()

    let resolveRefresh: (health: AutomationAiProviderHealth) => void = () => undefined
    vi.mocked(actions.checkAutomationAiProviderHealthAction).mockReturnValueOnce(
      new Promise<AutomationAiProviderHealth>(resolve => {
        resolveRefresh = resolve
      })
    )

    render(
      <ProviderHealthBadge
        provider={{ ...provider(providerId) }}
        modelId='qwen'
        autoCheck
      />
    )

    expect(screen.getByText('Online')).toBeTruthy()
    const refreshButton = screen.getByRole('button', { name: 'Check AI provider health' })
    fireEvent.click(refreshButton)

    expect(screen.getByText('Online')).toBeTruthy()
    expect(screen.queryByText('Checking')).toBeNull()

    await act(async () => {
      resolveRefresh(okHealth(providerId))
      await Promise.resolve()
    })
  })

  it('spins the refresh icon only for a manual health check', async () => {
    const providerId = `provider_${crypto.randomUUID()}`
    vi.mocked(actions.checkAutomationAiProviderHealthAction).mockResolvedValueOnce(okHealth(providerId))

    render(
      <ProviderHealthBadge
        provider={provider(providerId)}
        modelId='qwen'
        autoCheck
      />
    )

    expect(await screen.findByText('Online')).toBeTruthy()

    let resolveRefresh: (health: AutomationAiProviderHealth) => void = () => undefined
    vi.mocked(actions.checkAutomationAiProviderHealthAction).mockReturnValueOnce(
      new Promise<AutomationAiProviderHealth>(resolve => {
        resolveRefresh = resolve
      })
    )

    const refreshButton = screen.getByRole('button', { name: 'Check AI provider health' })
    fireEvent.click(refreshButton)

    await waitFor(() => expect(refreshButton).toHaveProperty('disabled', true))
    expect(screen.getByTestId('provider-health-refresh-icon').getAttribute('class')).toContain('animate-spin')

    await act(async () => {
      resolveRefresh(okHealth(providerId))
      await Promise.resolve()
    })
  })
})
