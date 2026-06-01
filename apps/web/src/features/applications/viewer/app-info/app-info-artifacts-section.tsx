import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppInfoRow } from './app-info-row'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

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
      <Visible when={app?.lastError}>
        <AppInfoRow
          label='Last error'
          value={app?.lastError ?? ''}
          copyValue={app?.lastError ?? undefined}
        />
      </Visible>
      <Visible when={app?.applicationError}>
        <AppInfoRow
          label='Error code'
          value={app?.applicationError ? `${app.applicationError.code} (${app.applicationError.phase})` : ''}
          copyValue={app?.applicationError ? `${app.applicationError.code}:${app.applicationError.phase}` : undefined}
        />
      </Visible>
      <Visible when={app?.applicationError?.exitCode !== null && app?.applicationError?.exitCode !== undefined}>
        <AppInfoRow
          label='Exit code'
          value={
            app?.applicationError?.exitCode !== null && app?.applicationError?.exitCode !== undefined
              ? String(app.applicationError.exitCode)
              : ''
          }
          copyValue={
            app?.applicationError?.exitCode !== null && app?.applicationError?.exitCode !== undefined
              ? String(app.applicationError.exitCode)
              : undefined
          }
        />
      </Visible>
      <Visible when={app?.applicationError?.hint}>
        <AppInfoRow
          label='Hint'
          value={app?.applicationError?.hint ?? ''}
          copyValue={app?.applicationError?.hint ?? undefined}
        />
      </Visible>
    </Section>
  )
}
