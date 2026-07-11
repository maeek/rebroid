import { useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { sendBff } from '@/lib/http/bff'
import { saveOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { terminalBuildStatuses } from '../model/context-selection'
import { gappsBuildPhases } from '../model/gapps-build'
import { useActiveBuildPolling } from './use-active-build-polling'
import type {
  ContainerImageBuildJob,
  GappsBuildPreset,
  GappsBuildPresetsResponse,
  SupportedGappsAndroidVersion
} from '@/shared/contracts/platform-image-build'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

interface GappsBuildControllerInput {
  presetResponse: GappsBuildPresetsResponse
  jobs: ContainerImageBuildJob[]
  initialSettings: OrchestratorUiSettings
  uploadedApkId?: string
}

export interface GappsBuildController {
  activeJob: ContainerImageBuildJob | null
  androidVersion: SupportedGappsAndroidVersion
  createAppHref: string
  currentPhaseIndex: number
  isClearing: boolean
  isRunning: boolean
  isStarting: boolean
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
  jobs,
  initialSettings,
  uploadedApkId
}: GappsBuildControllerInput): GappsBuildController => {
  const [androidVersion, setAndroidVersion] = useState<SupportedGappsAndroidVersion>('14')
  const preset = useMemo(
    () => presetResponse.presets.find(item => item.androidVersion === androidVersion) ?? presetResponse.presets[0],
    [androidVersion, presetResponse.presets]
  )
  const [targetImage, setTargetImage] = useState(preset?.defaultTargetImage ?? 'local/redroid-gapps:14')
  const [activeJob, setActiveJob] = useState<ContainerImageBuildJob | null>(
    () => jobs.find(job => job.buildKind === 'redroid_gapps_patch') ?? null
  )
  const [settings, setSettings] = useState(initialSettings)
  const [isStarting, setIsStarting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const isRunning = activeJob ? !terminalBuildStatuses.includes(activeJob.status) : false
  const currentPhaseIndex = gappsBuildPhases.findIndex(phase => phase.id === (activeJob?.phase ?? 'queued'))

  useActiveBuildPolling(activeJob, setActiveJob)

  const selectVersion = (version: SupportedGappsAndroidVersion) => {
    const nextPreset = presetResponse.presets.find(item => item.androidVersion === version)
    setAndroidVersion(version)
    if (nextPreset) setTargetImage(nextPreset.defaultTargetImage)
  }

  const startBuild = async () => {
    setIsStarting(true)
    try {
      const job = await sendBff<ContainerImageBuildJob>('/api/bff/platform/image-builds/gapps', {
        androidVersion,
        targetImage
      })
      setActiveJob(job)
      toast({ title: 'Google Play image queued' })
    } catch (error) {
      toast({
        title: 'Could not start build',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsStarting(false)
    }
  }

  const cancelBuild = async () => {
    if (!activeJob) return
    try {
      setActiveJob(
        await sendBff<ContainerImageBuildJob>(
          `/api/bff/platform/image-builds/${encodeURIComponent(activeJob.id)}/cancel`,
          {}
        )
      )
    } catch (error) {
      toast({ title: 'Could not cancel build', description: getDisplayErrorMessage(error), variant: 'danger' })
    }
  }

  const setAsDefault = async () => {
    if (!activeJob || activeJob.status !== 'succeeded') return
    try {
      const saved = await saveOrchestratorUiSettings({ ...settings, defaultContainerImage: activeJob.targetImage })
      setSettings(saved)
      toast({ title: 'Default image updated' })
    } catch (error) {
      toast({
        title: 'Could not update default image',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const clearCache = async () => {
    setIsClearing(true)
    try {
      await sendBff<unknown>('/api/bff/platform/image-builds/gapps/cache', { androidVersion }, 'DELETE')
      toast({ title: `Android ${androidVersion} GApps cache cleared` })
    } catch (error) {
      toast({ title: 'Could not clear cache', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      setIsClearing(false)
    }
  }

  const createAppQuery = new URLSearchParams({ image: activeJob?.targetImage ?? targetImage })
  if (uploadedApkId) createAppQuery.set('apk', uploadedApkId)

  return {
    activeJob,
    androidVersion,
    createAppHref: `/apps/create?${createAppQuery.toString()}`,
    currentPhaseIndex,
    isClearing,
    isRunning,
    isStarting,
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
