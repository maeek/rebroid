import { useMemo, useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { sendBff } from '@/lib/http/bff'
import { gappsBuildPhases } from '../model/gapps-build'
import { useActiveImageBuild } from './use-active-image-build'
import type {
  ContainerImageBuildJob,
  GappsBuildPreset,
  GappsBuildPresetsResponse,
  SupportedGappsAndroidVersion
} from '@/shared/contracts/platform'

interface GappsBuildControllerInput {
  presetResponse: GappsBuildPresetsResponse
  initialJob: ContainerImageBuildJob | null
  uploadedApkId?: string
}

export interface GappsBuildController {
  activeJob: ContainerImageBuildJob | null
  androidVersion: SupportedGappsAndroidVersion
  presets: GappsBuildPreset[]
  createAppHref: string
  currentPhaseIndex: number
  isClearing: boolean
  isCancelling: boolean
  isRunning: boolean
  isStarting: boolean
  isSettingDefault: boolean
  preset: GappsBuildPreset | undefined
  targetImage: string
  cancelBuild: () => Promise<void>
  clearCache: () => Promise<void>
  selectVersion: (version: SupportedGappsAndroidVersion) => void
  setAsDefault: () => Promise<void>
  setTargetImage: (value: string) => void
  startBuild: () => Promise<void>
}

export const useGappsBuildController = ({
  presetResponse,
  initialJob,
  uploadedApkId
}: GappsBuildControllerInput): GappsBuildController => {
  const [androidVersion, setAndroidVersion] = useState<SupportedGappsAndroidVersion>('14')
  const preset = useMemo(
    () => presetResponse.presets.find(item => item.androidVersion === androidVersion) ?? presetResponse.presets[0],
    [androidVersion, presetResponse.presets]
  )
  const [targetImage, setTargetImage] = useState(preset?.defaultTargetImage ?? 'local/redroid-gapps:14')
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
  const currentPhaseIndex = gappsBuildPhases.findIndex(phase => phase.id === (activeJob?.phase ?? 'queued'))

  const selectVersion = (version: SupportedGappsAndroidVersion) => {
    const nextPreset = presetResponse.presets.find(item => item.androidVersion === version)
    setAndroidVersion(version)
    if (nextPreset) setTargetImage(nextPreset.defaultTargetImage)
  }

  const startBuild = async () => {
    if (clearing.current || !presetResponse.resources.canBuild || !preset || !targetImage.trim()) return
    await startActiveBuild(
      () => sendBff<ContainerImageBuildJob>('/api/bff/platform/image-builds/gapps', { androidVersion, targetImage }),
      'Google Play image queued'
    )
  }

  const clearCache = async () => {
    if (clearing.current || !isIdle()) return
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
    createAppHref: `/apps/create?${createAppQuery.toString()}`,
    currentPhaseIndex,
    isClearing,
    isCancelling,
    isRunning,
    isStarting,
    isSettingDefault,
    preset,
    targetImage,
    cancelBuild,
    clearCache,
    selectVersion,
    setAsDefault,
    setTargetImage,
    startBuild
  }
}
