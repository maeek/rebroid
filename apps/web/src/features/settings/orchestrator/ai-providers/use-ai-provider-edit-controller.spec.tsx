import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrchestratorAiProviderEditPageClient } from './orchestrator-ai-provider-edit-page-client'
import { emptyModel, emptyProvider } from './provider-form-model'
import { useAiProviderEditController } from './use-ai-provider-edit-controller'
import type { AutomationAiProvider, AutomationAiProviderModel } from '@/shared/contracts/ai-provider'

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  download: vi.fn(),
  progress: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  toast: vi.fn()
}))
vi.mock('next/navigation', () => {
  const router = { refresh: mocks.refresh, replace: mocks.replace, push: mocks.push }
  return { useRouter: () => router }
})
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }))
vi.mock('@/server/orchestrator/settings/actions', () => ({
  createAutomationAiProviderModelAction: mocks.add,
  downloadAutomationAiProviderModelAction: mocks.download,
  getAutomationAiProviderModelDownloadAction: mocks.progress,
  listAutomationAiProviderRemoteModelsAction: mocks.list,
  updateAutomationAiProviderAction: mocks.save
}))
const provider = { ...emptyProvider(), id: 'local', label: 'Local', apiKey: '********' }

describe('provider editor persistence', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('keeps the connection draft across provider tabs and discards it only after confirmation', async () => {
    window.history.replaceState(null, '', '/platform/ai/local?view=connection')
    try {
      const queryClient = new QueryClient()
      const editor = (view: 'models' | 'connection') => (
        <QueryClientProvider client={queryClient}>
          <OrchestratorAiProviderEditPageClient
            initialProvider={provider}
            view={view}
          />
        </QueryClientProvider>
      )
      const { rerender } = render(editor('connection'))
      fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'http://draft:11434' } })

      const modelsLink = screen.getByRole('link', { name: 'Models' })
      let tabNavigationAllowed = false
      modelsLink.addEventListener(
        'click',
        event => {
          tabNavigationAllowed = !event.defaultPrevented
          event.preventDefault()
        },
        { once: true }
      )
      fireEvent.click(modelsLink)
      expect(tabNavigationAllowed).toBe(true)
      expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).toBeNull()
      rerender(editor('models'))
      rerender(editor('connection'))
      expect(screen.getByLabelText('Base URL')).toHaveValue('http://draft:11434')

      const leave = () => fireEvent.click(screen.getByRole('link', { name: 'AI' }))
      leave()
      fireEvent.click(await screen.findByRole('button', { name: 'Keep editing' }))
      expect(screen.getByLabelText('Base URL')).toHaveValue('http://draft:11434')
      expect(mocks.push).not.toHaveBeenCalled()

      leave()
      fireEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }))
      expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/platform/ai')
      expect(screen.getByLabelText('Base URL')).toHaveValue(provider.baseUrl)
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('marks individual connection edits, keeps them after failure, and clears them after saving or discarding', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <OrchestratorAiProviderEditPageClient
          initialProvider={provider}
          view='connection'
        />
      </QueryClientProvider>
    )
    const url = screen.getByLabelText('Base URL')
    const key = screen.getByLabelText('API key')
    const enabled = screen.getByRole('switch', { name: 'Available for automation' })
    expect(url).not.toHaveAccessibleDescription(expect.stringContaining('Unsaved change'))
    fireEvent.change(url, { target: { value: 'http://other:1234' } })
    expect(url).toHaveAccessibleDescription(expect.stringContaining('Unsaved change'))
    expect(key).not.toHaveAccessibleDescription(expect.stringContaining('Unsaved change'))
    fireEvent.change(url, { target: { value: provider.baseUrl } })
    expect(url).not.toHaveAccessibleDescription(expect.stringContaining('Unsaved change'))
    fireEvent.change(key, { target: { value: 'replacement-key' } })
    fireEvent.click(enabled)
    expect(key).toHaveAccessibleDescription(expect.stringContaining('Unsaved change'))
    expect(enabled).toHaveAccessibleDescription(expect.stringContaining('Unsaved change'))
    mocks.save.mockRejectedValueOnce(new Error('Unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' })))
    expect(key).toHaveAccessibleDescription(expect.stringContaining('Unsaved change'))
    mocks.save.mockImplementation((_id: string, input: AutomationAiProvider) =>
      Promise.resolve({ ...input, apiKey: '********' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(key).not.toHaveAccessibleDescription(expect.stringContaining('Unsaved change')))
    expect(key).toHaveValue('********')
    expect(enabled).not.toHaveAccessibleDescription(expect.stringContaining('Unsaved change'))
    fireEvent.change(url, { target: { value: 'http://draft:1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(url).toHaveValue(provider.baseUrl)
    expect(url).not.toHaveAccessibleDescription(expect.stringContaining('Unsaved change'))
  })

  it('retries transient progress errors without failing the download or overlapping requests', async () => {
    vi.useFakeTimers()
    const job = {
      id: 'job',
      providerId: 'local',
      modelId: 'model',
      status: 'queued',
      message: 'Queued',
      createdAt: '',
      updatedAt: ''
    }
    mocks.download.mockResolvedValue(job)
    mocks.progress.mockRejectedValueOnce(new Error('Temporary network error'))
    const { result } = renderHook(() => useAiProviderEditController(provider))
    await act(async () => {
      await result.current.downloadModel('model')
    })
    expect(result.current.isDirty).toBe(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(result.current.modelDownloads.model.status).toBe('queued')
    let complete: (value: unknown) => void = () => undefined
    mocks.progress.mockImplementation(
      () =>
        new Promise(resolve => {
          complete = resolve
        })
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(mocks.progress).toHaveBeenCalledTimes(2)
    await act(async () => {
      complete({ ...job, status: 'completed' })
      await Promise.resolve()
    })
    expect(result.current.modelDownloads.model.status).toBe('completed')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(mocks.progress).toHaveBeenCalledTimes(2)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('registers the exact model ID and selected purposes immediately without creating an unsaved draft', async () => {
    mocks.add.mockImplementation((_id: string, model: AutomationAiProviderModel) => Promise.resolve(model))
    const { result } = renderHook(() => useAiProviderEditController(provider))
    await act(async () => {
      expect(await result.current.addModel('Exact/Model:Q4', 'Screen model', ['vision'])).toBe(true)
    })
    expect(mocks.add).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({
        id: 'Exact/Model:Q4',
        label: 'Screen model',
        roles: ['vision'],
        defaultFor: ['vision']
      })
    )
    expect(result.current.provider.models[0].id).toBe('Exact/Model:Q4')
    expect(result.current.isDirty).toBe(false)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('blocks immediate model operations on an unsaved connection and discards to the saved baseline', async () => {
    const { result } = renderHook(() => useAiProviderEditController(provider))
    act(() => result.current.updateProvider({ baseUrl: 'http://other:1234' }))
    expect(result.current.isDirty).toBe(true)
    await act(async () => {
      expect(await result.current.addModel('model')).toBe(false)
    })
    await expect(result.current.downloadModel('model')).rejects.toThrow('Save or discard')
    expect(mocks.add).not.toHaveBeenCalled()
    expect(mocks.download).not.toHaveBeenCalled()
    act(() => result.current.discardChanges())
    expect(result.current.provider.baseUrl).toBe(provider.baseUrl)
    expect(result.current.isDirty).toBe(false)
  })

  it('retains draft model settings after failure and preserves credentials and transport in save payloads', async () => {
    const initial = {
      ...provider,
      models: [{ ...emptyModel(), id: 'model', defaultFor: ['controller' as const, 'planner' as const] }]
    }
    const { result } = renderHook(() => useAiProviderEditController(initial))
    act(() => result.current.updateModel(0, { settings: { temperature: 0.4 }, label: 'Renamed' }))
    mocks.save.mockRejectedValueOnce(new Error('Unavailable'))
    await act(async () => {
      await result.current.saveProvider()
    })
    expect(result.current.isDirty).toBe(true)
    expect(result.current.provider.models[0].settings.temperature).toBe(0.4)
    mocks.save.mockImplementation((_id: string, input: AutomationAiProvider) => Promise.resolve(input))
    await act(async () => {
      await result.current.saveProvider()
    })
    expect(mocks.save).toHaveBeenLastCalledWith(
      'local',
      expect.objectContaining({
        apiKey: '********',
        protocol: provider.protocol,
        serverFlavor: provider.serverFlavor,
        models: [expect.objectContaining({ id: 'model', label: 'Renamed', settings: { temperature: 0.4 } })]
      })
    )
    expect(result.current.isDirty).toBe(false)
  })

  it('prevents duplicate registration requests while the first is pending', async () => {
    let complete: (value: unknown) => void = () => undefined
    mocks.add.mockImplementation(
      () =>
        new Promise(resolve => {
          complete = resolve
        })
    )
    const { result } = renderHook(() => useAiProviderEditController(provider))
    let request: Promise<boolean>
    act(() => {
      request = result.current.addModel('model')
    })
    await act(async () => {
      expect(await result.current.addModel('model')).toBe(false)
    })
    expect(mocks.add).toHaveBeenCalledTimes(1)
    await act(async () => {
      complete({ ...emptyModel(), id: 'model', label: 'model' })
      await request
    })
    await waitFor(() => expect(result.current.provider.models).toHaveLength(1))
  })
})
