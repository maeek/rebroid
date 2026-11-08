import { BuildLogs } from '../ui/build-logs'
import { BuildRunPanel } from '../ui/build-run-panel'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

type BuildSectionProps = {
  activeJob: ContainerImageBuildJob | null
  isActiveJobRunning: boolean
  isCancelling: boolean
  isSettingDefault?: boolean
  onCancelBuild: () => void
  onSetAsDefault: () => void
  loading?: boolean
}

export const BuildSection = ({
  activeJob,
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
      running={isActiveJobRunning}
      cancelling={isCancelling}
      settingDefault={isSettingDefault}
      onCancel={onCancelBuild}
      onSetAsDefault={onSetAsDefault}
      createAppHref={`/apps/create?${new URLSearchParams({ image: activeJob?.targetImage ?? '' }).toString()}`}
      loading={loading}
    />
    {activeJob ? (
      <BuildLogs
        job={activeJob}
        running={isActiveJobRunning}
      />
    ) : null}
  </>
)
