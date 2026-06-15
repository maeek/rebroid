import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { ProviderHealthBadge } from './provider-health-badge'
import type { AutomationAiProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

jest.mock('@/server/orchestrator/settings/actions', () => ({
  checkAutomationAiProviderHealthAction: jest.fn()
}))

const actions = jest.requireMock<typeof import('@/server/orchestrator/settings/actions')>(
  '@/server/orchestrator/settings/actions'
)

const provider = (id: string): AutomationAiProvider =>
  ({
    id,
    label: 'Local',
    kind: 'ollama',
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
    jest.mocked(actions.checkAutomationAiProviderHealthAction).mockReset()
  })

  it('keeps the previous health label while refreshing a known provider/model', async () => {
    const providerId = `provider_${crypto.randomUUID()}`
    jest.mocked(actions.checkAutomationAiProviderHealthAction).mockResolvedValueOnce(okHealth(providerId))

    const { unmount } = render(
      <ProviderHealthBadge
        provider={provider(providerId)}
        modelId='qwen'
      />
    )

    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy())
    unmount()

    let resolveRefresh: (health: AutomationAiProviderHealth) => void = () => undefined
    jest.mocked(actions.checkAutomationAiProviderHealthAction).mockReturnValueOnce(
      new Promise<AutomationAiProviderHealth>(resolve => {
        resolveRefresh = resolve
      })
    )

    render(
      <ProviderHealthBadge
        provider={{ ...provider(providerId) }}
        modelId='qwen'
      />
    )

    expect(screen.getByText('Online')).toBeTruthy()
    expect(screen.queryByText('Checking')).toBeNull()
    const refreshButton = screen.getByRole('button', { name: 'Check AI provider health' })
    expect(refreshButton).not.toHaveProperty('disabled', true)
    expect(refreshButton.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')

    await act(async () => {
      resolveRefresh(okHealth(providerId))
    })
  })

  it('spins the refresh icon only for a manual health check', async () => {
    const providerId = `provider_${crypto.randomUUID()}`
    jest.mocked(actions.checkAutomationAiProviderHealthAction).mockResolvedValueOnce(okHealth(providerId))

    render(
      <ProviderHealthBadge
        provider={provider(providerId)}
        modelId='qwen'
      />
    )

    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy())

    let resolveRefresh: (health: AutomationAiProviderHealth) => void = () => undefined
    jest.mocked(actions.checkAutomationAiProviderHealthAction).mockReturnValueOnce(
      new Promise<AutomationAiProviderHealth>(resolve => {
        resolveRefresh = resolve
      })
    )

    const refreshButton = screen.getByRole('button', { name: 'Check AI provider health' })
    fireEvent.click(refreshButton)

    await waitFor(() => expect(refreshButton).toHaveProperty('disabled', true))
    expect(refreshButton.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')

    await act(async () => {
      resolveRefresh(okHealth(providerId))
    })
  })
})
