import { BuildLogs } from '../ui/build-logs'
import { BuildRunPanel } from '../ui/build-run-panel'
import type { UploadProgress } from '../model/dockerfile-context-types'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

type BuildSectionProps = {
  activeJob: ContainerImageBuildJob | null
  starting?: boolean
  contextUpload?: UploadProgress | null
  isActiveJobRunning: boolean
  isCancelling: boolean
  isSettingDefault?: boolean
  onCancelBuild: () => void
  onSetAsDefault: () => void
  loading?: boolean
}

export const BuildSection = ({
  activeJob,
  starting = false,
  contextUpload,
  isActiveJobRunning,
  isCancelling,
  isSettingDefault = false,
  onCancelBuild,
  onSetAsDefault,
  loading = false
}: BuildSectionProps) => (
  <>
    <BuildRunPanel
      job={activeJob}
      starting={starting}
      contextUpload={contextUpload}
      running={isActiveJobRunning}
      cancelling={isCancelling}
      settingDefault={isSettingDefault}
      onCancel={onCancelBuild}
      onSetAsDefault={onSetAsDefault}
      createAppHref={`/apps/create?${new URLSearchParams({ image: activeJob?.targetImage ?? '' }).toString()}`}
      loading={loading}
    />
    {activeJob && !starting ? (
      <BuildLogs
        job={activeJob}
        running={isActiveJobRunning}
      />
    ) : null}
  </>
)
