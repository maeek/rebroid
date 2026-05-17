import { Section } from '@/components/ui/section'
import { AppInfoRow } from './app-info-row'
import type { AppDefinition } from '@/app/(protected)/(standard)/constants'

export const AppInfoArtifactsSection = ({ app }: { app?: AppDefinition }) => {
  return (
    <Section
      title='Artifacts'
      boxed
      titleClassName='pb-4'
      contentClassName='flex-col'
    >
      <AppInfoRow
        label='APK'
        value={app?.apkOriginalName || 'No APK uploaded'}
        copyValue={app?.apkOriginalName || undefined}
      />
      {app?.lastError && (
        <AppInfoRow
          label='Last error'
          value={app.lastError}
          copyValue={app.lastError}
        />
      )}
      {app?.applicationError && (
        <AppInfoRow
          label='Error code'
          value={`${app.applicationError.code} (${app.applicationError.phase})`}
          copyValue={`${app.applicationError.code}:${app.applicationError.phase}`}
        />
      )}
      {app?.applicationError?.exitCode !== null && app?.applicationError?.exitCode !== undefined && (
        <AppInfoRow
          label='Exit code'
          value={String(app.applicationError.exitCode)}
          copyValue={String(app.applicationError.exitCode)}
        />
      )}
      {app?.applicationError?.hint && (
        <AppInfoRow
          label='Hint'
          value={app.applicationError.hint}
          copyValue={app.applicationError.hint}
        />
      )}
    </Section>
  )
}
