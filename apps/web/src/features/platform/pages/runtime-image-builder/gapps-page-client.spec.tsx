import { describe, expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { RuntimeGappsImageBuilderPageClient } from './gapps-page-client'
import type { ContainerImageBuildJob, GappsBuildPresetsResponse } from '@/server/orchestrator/platform/types'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

jest.mock('@/server/orchestrator/platform/image-actions', () => ({
  cancelImageBuildAction: jest.fn(),
  clearGappsCacheAction: jest.fn(),
  getImageBuildJobAction: jest.fn(),
  startGappsBuildAction: jest.fn()
}))
jest.mock('@/shared/model/settings/use-orchestrator-ui-settings', () => ({
  saveOrchestratorUiSettings: jest.fn()
}))

const presetResponse: GappsBuildPresetsResponse = {
  presets: [
    {
      androidVersion: '14',
      baseImage: 'redroid/redroid:14.0.0-latest',
      sourceBranch: 'upsilon',
      sourceRepository: 'https://gitlab.com/MindTheGapps/vendor_gapps.git',
      sourceLink: 'https://gitlab.com/MindTheGapps/vendor_gapps/-/tree/upsilon',
      defaultTargetImage: 'local/redroid-gapps:14'
    },
    {
      androidVersion: '13',
      baseImage: 'redroid/redroid:13.0.0-latest',
      sourceBranch: 'tau',
      sourceRepository: 'https://gitlab.com/MindTheGapps/vendor_gapps.git',
      sourceLink: 'https://gitlab.com/MindTheGapps/vendor_gapps/-/tree/tau',
      defaultTargetImage: 'local/redroid-gapps:13'
    }
  ],
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
  it('presents one primary build action without custom-builder controls', () => {
    render(
      <RuntimeGappsImageBuilderPageClient
        presetResponse={presetResponse}
        jobs={[]}
        initialSettings={{} as OrchestratorUiSettings}
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
          initialSettings={{} as OrchestratorUiSettings}
        />
      )

      const log = screen.getByTestId('build-log')
      expect(screen.getByRole('heading', { name: 'Build progress' })).toBeTruthy()
      expect(screen.getByRole('complementary')).toBeTruthy()
      expect(screen.getByText('Following latest output')).toBeTruthy()
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
})
