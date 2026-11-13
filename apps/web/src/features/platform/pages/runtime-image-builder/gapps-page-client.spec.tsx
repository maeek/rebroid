import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendBff } from '@/lib/http/bff'
import { RuntimeGappsImageBuilderPageClient } from './gapps-page-client'
import type { ContainerImageBuildJob, GappsBuildPresetsResponse } from '@/shared/contracts/platform'

vi.mock('@/lib/http/bff', () => ({
  getBff: vi.fn(),
  sendBff: vi.fn()
}))
vi.mock('@/shared/model/settings/use-orchestrator-ui-settings', () => ({
  saveOrchestratorUiSettings: vi.fn()
}))

const presetResponse: GappsBuildPresetsResponse = {
  presets: (
    [
      ['16', 'baklava'],
      ['15', 'vic'],
      ['14', 'upsilon'],
      ['13', 'tau']
    ] as const
  ).map(([androidVersion, sourceBranch]) => ({
    androidVersion,
    baseImage: `redroid/redroid:${androidVersion}.0.0-latest`,
    sourceBranch,
    sourceRepository: 'https://gitlab.com/MindTheGapps/vendor_gapps.git',
    sourceLink: `https://gitlab.com/MindTheGapps/vendor_gapps/-/tree/${sourceBranch}`,
    defaultTargetImage: `local/redroid-gapps:${androidVersion}`
  })),
  resources: {
    canBuild: true,
    diskAvailableBytes: 20 * 1024 ** 3,
    memoryAvailableBytes: 4 * 1024 ** 3,
    cpuCount: 2,
    diskRequirementMet: true,
    memoryRequirementMet: true,
    cpuRecommendationMet: true,
    messages: ['Ready to build.']
  }
}

describe('RuntimeGappsImageBuilderPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('presents one primary build action without custom-builder controls', () => {
    render(
      <RuntimeGappsImageBuilderPageClient
        presetResponse={presetResponse}
        jobs={[]}
      />
    )

    expect(screen.getAllByRole('button', { name: 'Build image' })).toHaveLength(1)
    expect(screen.queryByText('Dockerfile')).toBeNull()
    expect(screen.queryByText('Context')).toBeNull()
    expect(screen.getByRole('link', { name: 'Custom builder' })).toBeTruthy()
  })

  it('shows progress beside a live log that follows the latest output', () => {
    const scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 480 })
    const activeJob = {
      id: 'job-1',
      buildKind: 'redroid_gapps_patch',
      status: 'running',
      phase: 'building_gapps',
      targetImage: 'local/redroid-gapps:14',
      logTail: 'Building package'
    } as ContainerImageBuildJob

    try {
      render(
        <RuntimeGappsImageBuilderPageClient
          presetResponse={presetResponse}
          jobs={[activeJob]}
        />
      )

      const log = screen.getByLabelText('Build logs', { selector: 'pre' })
      expect(screen.getByRole('heading', { name: 'Build status' })).toBeTruthy()
      expect(screen.getByRole('complementary')).toBeTruthy()
      expect(screen.getByRole('switch', { name: 'Follow latest output' })).toBeChecked()
      expect(screen.getByText(/Step 4 of 8/)).toBeTruthy()
      const activePhase = screen.getByTestId('active-build-phase')
      expect(activePhase).toHaveAttribute('aria-current', 'step')
      expect(screen.getByTestId('active-phase-spinner')).toHaveClass('motion-safe:animate-spin')
      expect(screen.queryByRole('progressbar')).toBeNull()
      expect(log).toHaveClass('max-w-full', 'min-w-0', 'overflow-auto', 'whitespace-pre')
      expect(log.textContent).toContain('Building package')
      expect(log.scrollTop).toBe(480)
    } finally {
      if (scrollHeight) {
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeight)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight')
      }
    }
  })

  it.each(['14', '15', '16'])('starts an Android %s build through the BFF', async androidVersion => {
    const targetImage = `local/redroid-gapps:${androidVersion}`
    const queuedJob = {
      id: 'job-2',
      buildKind: 'redroid_gapps_patch',
      status: 'queued',
      phase: 'queued',
      targetImage,
      logTail: ''
    } as ContainerImageBuildJob
    vi.mocked(sendBff).mockResolvedValue(queuedJob)

    render(
      <RuntimeGappsImageBuilderPageClient
        presetResponse={presetResponse}
        jobs={[]}
      />
    )

    if (androidVersion !== '14') {
      fireEvent.click(screen.getByRole('combobox', { name: 'Android version' }))
      const option = await screen.findByRole('option', { name: `Android ${androidVersion}` })
      fireEvent.pointerDown(option, { pointerType: 'mouse' })
      fireEvent.click(option)
    }
    expect(screen.getByRole('textbox', { name: 'Target image' })).toHaveValue(targetImage)
    fireEvent.click(screen.getByRole('button', { name: 'Build image' }))

    await waitFor(() => {
      expect(sendBff).toHaveBeenCalledWith('/api/bff/platform/image-builds/gapps', {
        androidVersion,
        targetImage
      })
    })
    expect(screen.getByRole('button', { name: 'Build in progress' })).toBeDisabled()
  })

  it('shows cancellation progress while the request is pending', async () => {
    const activeJob = {
      id: 'job-3',
      buildKind: 'redroid_gapps_patch',
      status: 'running',
      phase: 'building_image',
      targetImage: 'local/redroid-gapps:14',
      logTail: 'Patching image'
    } as ContainerImageBuildJob
    vi.mocked(sendBff).mockImplementation(() => new Promise(() => undefined))

    render(
      <RuntimeGappsImageBuilderPageClient
        presetResponse={presetResponse}
        jobs={[activeJob]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel build' }))

    expect(await screen.findByRole('button', { name: 'Cancelling…' })).toHaveAttribute('aria-busy', 'true')
  })
})
