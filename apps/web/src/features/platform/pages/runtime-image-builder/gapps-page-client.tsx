'use client'

import { IconHammer } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { useGappsBuildController } from './hooks/use-gapps-build-controller'
import { GappsBuildConfiguration } from './sections/gapps-build-configuration'
import { GappsBuildProgress } from './sections/gapps-build-progress'
import { ImageBuilderColumns, ImageBuilderLayout } from './ui/image-builder-layout'
import type { GappsBuildController } from './hooks/use-gapps-build-controller'
import type { ContainerImageBuildJob, GappsBuildPresetsResponse } from '@/shared/contracts/platform'

type GappsBuilderProps = {
  presetResponse: GappsBuildPresetsResponse
  jobs: ContainerImageBuildJob[]
  uploadedApkId?: string
}

export const GappsBuilderContent = ({
  controller,
  resources,
  loading = false
}: {
  controller: GappsBuildController
  resources: GappsBuildPresetsResponse['resources']
  loading?: boolean
}) => (
  <ImageBuilderLayout
    mode='gapps'
    actions={
      <MutationButton
        type='button'
        pending={controller.isStarting || controller.isRunning}
        pendingLabel={controller.isRunning ? 'Build in progress' : 'Starting build…'}
        disabled={
          loading ||
          !resources.canBuild ||
          !controller.preset ||
          !controller.targetImage.trim() ||
          controller.isClearing ||
          controller.isCancelling
        }
        onClick={() => void controller.startBuild()}
      >
        <IconHammer className='size-4' /> Build image
      </MutationButton>
    }
  >
    <ImageBuilderColumns
      configuration={
        <GappsBuildConfiguration
          controller={controller}
          resources={resources}
          loading={loading}
        />
      }
      workspace={
        <GappsBuildProgress
          controller={controller}
          loading={loading}
        />
      }
    />
  </ImageBuilderLayout>
)

export const RuntimeGappsImageBuilderPageClient = (props: GappsBuilderProps) => {
  const controller = useGappsBuildController(props)
  return (
    <GappsBuilderContent
      controller={controller}
      resources={props.presetResponse.resources}
    />
  )
}

const noop = () => undefined
const pendingController: GappsBuildController = {
  activeJob: null,
  androidVersion: '14',
  createAppHref: '/apps/create',
  currentPhaseIndex: -1,
  isClearing: false,
  isCancelling: false,
  isRunning: false,
  isStarting: false,
  isSettingDefault: false,
  preset: undefined,
  targetImage: '',
  cancelBuild: () => Promise.resolve(),
  clearCache: () => Promise.resolve(),
  selectVersion: noop,
  setAsDefault: () => Promise.resolve(),
  setTargetImage: noop,
  startBuild: () => Promise.resolve()
}
export const RuntimeGappsImageBuilderPageLoading = () => (
  <GappsBuilderContent
    controller={pendingController}
    loading
    resources={{
      canBuild: false,
      diskAvailableBytes: 0,
      memoryAvailableBytes: 0,
      cpuCount: 0,
      diskRequirementMet: false,
      memoryRequirementMet: false,
      cpuRecommendationMet: false,
      messages: []
    }}
  />
)
