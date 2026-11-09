'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { editorSectionClassName } from '@/components/ui/surface'
import { AppManageTechnicalDetails } from '@/features/applications/manage/app-manage-technical-details'
import { AppViewerActions } from '@/features/applications/viewer/actions/app-viewer-actions'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { AppLogsContent } from '@/features/applications/viewer/logs/app-logs-content'
import { hasPermission } from '@/shared/permissions/permissions'
import { DetailFields } from '@/shared/ui/detail-fields'
import { ResourceLink } from '@/shared/ui/resource-link'
import { AppResourceLayout, AppResourceOverviewLayout } from './app-resource-layout'
import { appResourceHref } from './app-resource-links'
import { AppResourceNavigation } from './app-resource-navigation'
import { AppViewerStatusSection } from './app-viewer-status-section'
import { useApplicationViewerApp } from './application-viewer-context'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppResourceHome = ({
  view,
  activity
}: {
  view: 'overview' | 'activity' | 'diagnostics'
  activity?: ReactNode
}) => {
  const { app, permissions, isForeignOwnedApp, canViewInfrastructure, canViewAuditActivity } = useApplicationViewerApp()
  const canViewLogs = !isForeignOwnedApp && hasPermission(permissions, 'applications:view-logs')
  const canViewDetails = hasPermission(permissions, 'applications:view-backend-details')
  const canDiagnose = canViewLogs || canViewDetails
  const base = `/app/${encodeURIComponent(app.id)}`

  return (
    <AppResourceLayout
      heading={
        <AppViewerHeading
          app={app}
          showStatusBadge
        >
          <AppViewerActions mode='resource' />
        </AppViewerHeading>
      }
      navigation={
        <AppResourceNavigation
          appId={app.id}
          active={view}
          permissions={permissions}
          isForeignOwnedApp={isForeignOwnedApp}
          canViewAuditActivity={canViewAuditActivity}
        />
      }
      status={
        <AppViewerStatusSection
          app={app}
          canDiagnose={canDiagnose && view !== 'diagnostics'}
          showErrorDetails={canViewDetails}
        />
      }
    >
      {isForeignOwnedApp ? (
        <Notice
          title='Administrator view'
          description={`Owned by ${app.ownerDisplayName ?? app.ownerUserId ?? 'another user'}. Runtime interaction is restricted.`}
        />
      ) : null}
      {view === 'overview' ? (
        <AppResourceOverviewLayout
          summary={
            <AppConfigurationSummary
              app={app}
              canViewInfrastructure={canViewInfrastructure}
            />
          }
          actions={
            <Section
              surface='plain'
              title='Next actions'
              orientation='horizontal'
              contentClassName='flex-wrap gap-3'
            >
              <Button
                asChild
                variant='outline'
              >
                <Link href={appResourceHref(app.id, 'configuration')}>Edit configuration</Link>
              </Button>
              {canDiagnose ? (
                <Button
                  asChild
                  variant='outline'
                >
                  <Link href={`${base}?view=diagnostics`}>Inspect diagnostics</Link>
                </Button>
              ) : null}
              {hasPermission(permissions, 'automations:manage') ? (
                <Button
                  asChild
                  variant='outline'
                >
                  <Link href={`/automations?targetApplicationId=${encodeURIComponent(app.id)}`}>Related workflows</Link>
                </Button>
              ) : null}
            </Section>
          }
        />
      ) : null}
      {view === 'activity'
        ? (activity ?? (
            <Notice
              title='Activity unavailable'
              description='Audit activity is available to platform administrators.'
            />
          ))
        : null}
      {view === 'diagnostics' ? (
        <div className='grid min-w-0 gap-6'>
          {canViewDetails ? (
            <AppManageTechnicalDetails
              app={app}
              canViewInfrastructure={canViewInfrastructure}
            />
          ) : null}
          {canViewLogs ? (
            <Section
              surface='plain'
              title='Application logs'
              className={editorSectionClassName}
              description='Inspect startup output and Android logs.'
            >
              <AppLogsContent app={app} />
            </Section>
          ) : null}
          {!canDiagnose ? (
            <Notice
              tone='warning'
              title='Diagnostics unavailable'
              description='You do not have permission to inspect this app.'
            />
          ) : null}
        </div>
      ) : null}
    </AppResourceLayout>
  )
}

export const AppConfigurationSummary = ({
  app,
  canViewInfrastructure = false,
  loading = false
}: {
  app?: AppDefinition
  canViewInfrastructure?: boolean
  loading?: boolean
}) => (
  <Section
    surface='plain'
    title='Configuration summary'
    className={editorSectionClassName}
  >
    <DetailFields
      loading={loading}
      fields={[
        { label: 'Name', value: app?.name },
        { label: 'APK', value: app?.apkOriginalName ?? 'No APK installed' },
        {
          label: 'Runtime image',
          value:
            canViewInfrastructure && app?.containerImage ? (
              <ResourceLink href={`/runtime/images/${encodeURIComponent(app?.containerImage)}`}>
                {app?.containerImage}
              </ResourceLink>
            ) : (
              app?.containerImage
            )
        },
        { label: 'Profile', value: `${app?.profileName ?? 'default'} · ${app?.profileMode}` },
        {
          label: 'Memory limit',
          value: app?.memoryLimitMb === null ? 'Runtime default' : `${app?.memoryLimitMb} MB`
        },
        {
          label: 'CPU limit',
          value: app?.cpuLimitCpus === null ? 'Runtime default' : `${app?.cpuLimitCpus} cores`
        },
        {
          label: 'Network access',
          value: app?.networkPolicyEnabled ? 'Restricted to API and allowlist' : 'Unrestricted'
        }
      ]}
    />
  </Section>
)
