import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppInfoRow } from './app-info-row'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type ApplicationError = NonNullable<AppDefinition['applicationError']>

const getApkName = (app?: AppDefinition) => app?.apkOriginalName ?? 'No APK uploaded'

const getApkCopyValue = (app?: AppDefinition) => app?.apkOriginalName ?? undefined

const getLastError = (app?: AppDefinition) => app?.lastError ?? undefined

const getApplicationError = (app?: AppDefinition) => app?.applicationError ?? undefined

const OptionalArtifactRow = ({
  label,
  value,
  copyValue = value
}: {
  label: string
  value?: string
  copyValue?: string
}) => (
  <Visible when={value}>
    <AppInfoRow
      label={label}
      value={value}
      copyValue={copyValue}
    />
  </Visible>
)

const ApplicationErrorCodeRow = ({ error }: { error?: ApplicationError }) => {
  if (!error) {
    return null
  }

  return (
    <AppInfoRow
      label='Error code'
      value={`${error.code} (${error.phase})`}
      copyValue={`${error.code}:${error.phase}`}
    />
  )
}

const ApplicationErrorExitCodeRow = ({ error }: { error?: ApplicationError }) => {
  const exitCode = error?.exitCode

  if (exitCode === null || exitCode === undefined) {
    return null
  }

  return (
    <AppInfoRow
      label='Exit code'
      value={String(exitCode)}
      copyValue={String(exitCode)}
    />
  )
}

const ApplicationErrorRows = ({ error }: { error?: ApplicationError }) => (
  <>
    <Visible when={error}>
      <ApplicationErrorCodeRow error={error} />
    </Visible>
    <ApplicationErrorExitCodeRow error={error} />
    <OptionalArtifactRow
      label='Hint'
      value={error?.hint ?? undefined}
    />
  </>
)

export const AppInfoArtifactsSection = ({ app }: { app?: AppDefinition }) => {
  const applicationError = getApplicationError(app)

  return (
    <Section
      surface='plain'
      title='Artifacts'
      headingSpacing='default'
      contentClassName='flex-col'
    >
      <AppInfoRow
        label='APK'
        value={getApkName(app)}
        copyValue={getApkCopyValue(app)}
      />
      <OptionalArtifactRow
        label='Last error'
        value={getLastError(app)}
      />
      <ApplicationErrorRows error={applicationError} />
    </Section>
  )
}
