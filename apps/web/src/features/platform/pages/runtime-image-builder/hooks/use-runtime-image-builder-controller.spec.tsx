import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import { sendBff } from '@/lib/http/bff'
import { startImageBuildAction } from '@/server/orchestrator/platform/image-actions'
import { actionOk } from '@/shared/actions/action-result'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { useRuntimeImageBuilderController } from './use-runtime-image-builder-controller'
import type { ContainerImageBuildContextFile, ContainerImageBuildJob } from '@/shared/contracts/platform'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/lib/http/bff', () => ({ sendBff: vi.fn() }))
vi.mock('@/server/orchestrator/platform/image-actions', () => ({
  createImageBuildRecipeAction: vi.fn(),
  removeImageBuildContextFileAction: vi.fn(),
  startImageBuildAction: vi.fn()
}))
vi.mock('@/shared/model/settings/use-orchestrator-ui-settings', () => ({
  saveOrchestratorUiSettings: vi.fn()
}))
vi.mock('./use-active-build-polling', () => ({ useActiveBuildPolling: vi.fn() }))

const contextFiles = [
  { id: 'apk', contextPath: 'apks/GmsCore.apk' },
  { id: 'permissions', contextPath: 'permissions/privapp-permissions-microg.xml' }
] as ContainerImageBuildContextFile[]

const job = (status: ContainerImageBuildJob['status']): ContainerImageBuildJob =>
  ({
    id: 'job-1',
    status,
    targetImage: 'local/redroid-microg:14',
    logTail: status === 'running' ? 'Building layer' : ''
  }) as ContainerImageBuildJob

const renderBuilder = (jobs: ContainerImageBuildJob[] = []) =>
  renderHook(() =>
    useRuntimeImageBuilderController({
      contextFiles,
      images: [],
      initialSettings: defaultOrchestratorUiSettings,
      jobs,
      recipes: []
    })
  )

describe('useRuntimeImageBuilderController', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps recipe editing, context selection, and build start in one controller state', async () => {
    vi.mocked(startImageBuildAction).mockResolvedValue(actionOk(job('queued')))
    const { result } = renderBuilder()

    act(() => {
      result.current.recipeSectionProps.onPatchValues({ name: 'Team image' })
      result.current.contextSectionProps.onToggleContextFile('apk', true)
      result.current.contextSectionProps.onToggleContextFile('permissions', true)
    })

    expect(result.current.recipeSectionProps.values.name).toBe('Team image')
    expect(result.current.canStart).toBe(true)
    await act(() => result.current.startBuild())

    const buildInput = vi.mocked(startImageBuildAction).mock.calls[0]?.[0]
    expect(buildInput?.name).toBe('Team image')
    expect(buildInput?.contextFileIds).toEqual(['apk', 'permissions'])
    expect(result.current.buildSectionProps.activeJob?.status).toBe('queued')
    expect(toast).toHaveBeenCalledWith({ title: 'Build started', variant: 'success' })
  })

  it('exposes live progress and replaces it with the cancelled job', async () => {
    vi.mocked(sendBff).mockResolvedValue(job('cancelled'))
    const { result } = renderBuilder([job('running')])

    expect(result.current.buildSectionProps.isActiveJobRunning).toBe(true)
    expect(result.current.buildSectionProps.activeJob?.logTail).toBe('Building layer')
    act(() => result.current.buildSectionProps.onCancelBuild())

    await waitFor(() => expect(result.current.buildSectionProps.activeJob?.status).toBe('cancelled'))
    expect(sendBff).toHaveBeenCalledWith('/api/bff/platform/image-builds/job-1/cancel', {})
  })

  it('keeps a failed start recoverable and reports safe feedback', async () => {
    vi.mocked(startImageBuildAction).mockRejectedValue(new Error('upstream unavailable'))
    const { result } = renderBuilder()
    act(() => {
      result.current.contextSectionProps.onToggleContextFile('apk', true)
      result.current.contextSectionProps.onToggleContextFile('permissions', true)
    })

    await act(() => result.current.startBuild())

    expect(result.current.isStarting).toBe(false)
    expect(result.current.buildSectionProps.activeJob).toBeNull()
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Could not start build',
        description: 'upstream unavailable',
        variant: 'danger'
      })
    )
  })
})
