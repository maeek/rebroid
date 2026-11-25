import { useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { sendBff } from '@/lib/http/bff'
import { buildTargetImageError } from '../model/build-validation'
import { gappsBuildPhases } from '../model/gapps-build'
import { useActiveImageBuild } from './use-active-image-build'
import type {
  ContainerImageBuildJob,
  GappsBuildPresetsResponse,
  SupportedGappsAndroidVersion
} from '@/shared/contracts/platform'

interface GappsBuildControllerInput {
  presetResponse: GappsBuildPresetsResponse
  initialJob: ContainerImageBuildJob | null
  uploadedApkId?: string
}

export const useGappsBuildController = ({ presetResponse, initialJob, uploadedApkId }: GappsBuildControllerInput) => {
  const [selection, setSelection] = useState<{ version: SupportedGappsAndroidVersion; targetImage?: string }>({
    version: '14'
  })
  const preset =
    presetResponse.presets.find(item => item.androidVersion === selection.version) ?? presetResponse.presets.at(0)
  const androidVersion = preset?.androidVersion ?? selection.version
  const editedTarget = androidVersion === selection.version ? selection.targetImage : undefined
  const targetImage = editedTarget ?? preset?.defaultTargetImage ?? ''
  const {
    activeJob,
    isIdle,
    isRunning,
    isStarting,
    isCancelling,
    startBuild: startActiveBuild,
    cancelBuild,
    isSettingDefault,
    setAsDefault
  } = useActiveImageBuild(initialJob)
  const [isClearing, setIsClearing] = useState(false)
  const clearing = useRef(false)
  const targetImageError = buildTargetImageError(targetImage)
  const currentPhaseIndex = gappsBuildPhases.findIndex(phase => phase.id === (activeJob?.phase ?? 'queued'))

  const startBuild = async () => {
    if (clearing.current || !presetResponse.resources.canBuild || !preset || targetImageError) return
    await startActiveBuild(
      () => sendBff<ContainerImageBuildJob>('/api/bff/platform/image-builds/gapps', { androidVersion, targetImage }),
      'Google Play image queued'
    )
  }

  const clearCache = async () => {
    if (clearing.current || !isIdle() || !preset) return
    clearing.current = true
    setIsClearing(true)
    try {
      await sendBff<unknown>('/api/bff/platform/image-builds/gapps/cache', { androidVersion }, 'DELETE')
      toast({ title: `Android ${androidVersion} GApps cache cleared`, variant: 'success' })
    } catch (error) {
      toast({ title: 'Could not clear cache', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      clearing.current = false
      setIsClearing(false)
    }
  }

  const createAppQuery = new URLSearchParams({ image: activeJob?.targetImage ?? targetImage })
  if (uploadedApkId) createAppQuery.set('apk', uploadedApkId)

  return {
    activeJob,
    androidVersion,
    presets: presetResponse.presets,
    createAppHref: `/apps/new?${createAppQuery.toString()}`,
    currentPhaseIndex,
    isClearing,
    isCancelling,
    isRunning,
    isStarting,
    isSettingDefault,
    preset,
    targetImage,
    targetImageError,
    cancelBuild,
    clearCache,
    selectVersion: (version: SupportedGappsAndroidVersion) => setSelection({ version }),
    setAsDefault,
    setTargetImage: (value: string) => setSelection({ version: androidVersion, targetImage: value }),
    startBuild
  }
}

export type GappsBuildController = ReturnType<typeof useGappsBuildController>
