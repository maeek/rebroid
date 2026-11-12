import { Section } from '@/components/ui/section'
import { appResourceHref } from '@/shared/model/applications/app-resource-links'
import { outboundAccessLabel } from '@/shared/model/network/outbound-policy'
import { ResourceLink } from '@/shared/ui/resource-link'
import { AppInfoRow } from './app-info-row'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppInfoNetworkSection = ({
  app,
  canConfigureEgress,
  canViewBackendDetails
}: {
  app?: AppDefinition
  canConfigureEgress: boolean
  canViewBackendDetails: boolean
}) => (
  <Section
    surface='plain'
    title='Network'
    headingSpacing='default'
    contentClassName='flex-col'
  >
    {canConfigureEgress ? (
      <AppInfoRow
        label='Outbound access'
        value={
          app ? (
            <ResourceLink href={appResourceHref(app.id, 'network')}>
              {outboundAccessLabel(app.networkPolicyEnabled)}
            </ResourceLink>
          ) : (
            'Loading…'
          )
        }
      />
    ) : null}
    {canViewBackendDetails ? (
      <>
        <AppInfoRow
          label='Network'
          value={app?.networkName ?? 'Loading…'}
          copyValue={app?.networkName}
        />
        <AppInfoRow
          label='ADB'
          value={app ? `${app.containerName}:${app.adbPort}` : 'Loading…'}
          copyValue={app ? `${app.containerName}:${app.adbPort}` : undefined}
        />
        <AppInfoRow
          label='Transport'
          value={app?.scrcpyTransport ?? 'Loading…'}
        />
      </>
    ) : null}
  </Section>
)
