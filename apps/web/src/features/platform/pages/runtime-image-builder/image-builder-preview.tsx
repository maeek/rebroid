'use client'

import { GappsBuilderContent, RuntimeGappsImageBuilderPageLoading } from './gapps-page-client'
import { useGappsBuildController } from './hooks/use-gapps-build-controller'
import { useRuntimeImageBuilderController } from './hooks/use-runtime-image-builder-controller'
import { defaultBuilderValues } from './model/builder-values'
import { CustomBuilderContent, RuntimeImageBuilderPageLoading } from './page-client'
import type {
  ContainerImageBuildContextFile,
  ContainerImageBuildJob,
  GappsBuildPresetsResponse
} from '@/shared/contracts/platform'

export const builderPreviewPresets: GappsBuildPresetsResponse = {
  presets: ['14', '13'].map(version => ({
    androidVersion: version as '14' | '13',
    baseImage: `redroid/redroid:${version}.0.0-latest`,
    sourceBranch: version === '14' ? 'upsilon' : 'tau',
    sourceRepository: 'https://gitlab.com/MindTheGapps/vendor_gapps.git',
    sourceLink: 'https://gitlab.com/MindTheGapps/vendor_gapps/-/tree/upsilon',
    defaultTargetImage: `local/redroid-gapps:${version}`
  })),
  resources: {
    canBuild: true,
    diskAvailableBytes: 40 * 1024 ** 3,
    memoryAvailableBytes: 8 * 1024 ** 3,
    cpuCount: 8,
    diskRequirementMet: true,
    memoryRequirementMet: true,
    cpuRecommendationMet: true,
    messages: ['Disk and memory requirements met.']
  }
}
export const builderPreviewJob = (
  status: ContainerImageBuildJob['status'],
  custom = false
): ContainerImageBuildJob => ({
  ...defaultBuilderValues,
  id: 'preview-build',
  buildKind: custom ? 'dockerfile_overlay' : 'redroid_gapps_patch',
  status,
  phase: status === 'succeeded' ? 'complete' : 'building_gapps',
  targetImage: custom ? 'local/redroid-microg:14' : 'local/redroid-gapps:14',
  cacheState: 'built',
  validationResults: {},
  contextFileIdsJson: '[]',
  logTail:
    'Resolving source revision…\nUsing verified package cache.\nBuilding image layer 3/6…\n' +
    'Long build output '.repeat(60),
  imageId: status === 'succeeded' ? 'sha256:preview-image' : null,
  error: status === 'failed' ? 'Image validation failed: required Google packages were not found.' : null,
  createdAt: '2026-11-08T10:00:00Z',
  updatedAt: '2026-11-08T10:03:00Z'
})
export const builderPreviewFiles: ContainerImageBuildContextFile[] = [
  'apks/GmsCore.apk',
  'permissions/privapp-permissions-microg.xml'
].map((contextPath, index) => ({
  id: `file-${index}`,
  contextPath,
  originalName: contextPath.split('/').at(-1)!,
  storedPath: '',
  sizeBytes: 1024,
  sha256: 'preview',
  createdAt: '2026-11-08T10:00:00Z'
}))

export const ImageBuilderPreview = ({ mode, state = 'idle' }: { mode: 'gapps' | 'custom'; state?: string }) => {
  let content
  if (state === 'loading')
    content = mode === 'custom' ? <RuntimeImageBuilderPageLoading /> : <RuntimeGappsImageBuilderPageLoading />
  else content = mode === 'custom' ? <CustomPreview state={state} /> : <GappsPreview state={state} />
  return <div data-builder-page>{content}</div>
}

const GappsPreview = ({ state }: { state: string }) => {
  const status = state === 'running' || state === 'failed' || state === 'succeeded' ? state : null
  const presets =
    state === 'blocked'
      ? {
          ...builderPreviewPresets,
          resources: {
            ...builderPreviewPresets.resources,
            canBuild: false,
            memoryRequirementMet: false,
            memoryAvailableBytes: 512 * 1024 ** 2,
            messages: ['At least 3 GB of available Docker memory is required.']
          }
        }
      : builderPreviewPresets
  const controller = useGappsBuildController({ presetResponse: presets, jobs: [] })
  const job = status ? builderPreviewJob(status) : null
  return (
    <GappsBuilderContent
      resources={presets.resources}
      controller={{
        ...controller,
        activeJob: job,
        isRunning: status === 'running',
        currentPhaseIndex: status === 'succeeded' ? 7 : 3
      }}
    />
  )
}
const CustomPreview = ({ state }: { state: string }) => {
  const builder = useRuntimeImageBuilderController({
    contextFiles: state === 'missing' ? [] : builderPreviewFiles,
    images: [],
    jobs: [],
    recipes: []
  })
  const status = state === 'running' || state === 'failed' || state === 'succeeded' ? state : null
  const job = status ? builderPreviewJob(status, true) : null
  return (
    <CustomBuilderContent
      builder={{
        ...builder,
        isActiveJobRunning: status === 'running',
        canStart: builder.canStart && status !== 'running',
        buildSectionProps: { ...builder.buildSectionProps, activeJob: job, isActiveJobRunning: status === 'running' }
      }}
    />
  )
}
