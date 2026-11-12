'use client'

import { Suspense } from 'react'
import { IconDeviceFloppy, IconPlayerPlay } from '@tabler/icons-react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { AppIdentitySection } from '@/features/applications/components/app-identity-section'
import { getInitialCreateAppFormValues } from '@/features/applications/create/create-app-form-model'
import { AppFormIconSection } from '@/features/applications/create/create-app-icon-section'
import { AppConfigurationMenu } from '@/features/applications/manage/app-configuration-menu'
import { AppNetworkPolicySettingsLoading } from '@/features/applications/manage/app-manage-network-policy-settings'
import { AppProfilesSection } from '@/features/applications/manage/app-manage-profiles'
import { AppManageRuntimeSettings } from '@/features/applications/manage/app-manage-runtime-settings'
import { AppManageTechnicalDetails } from '@/features/applications/manage/app-manage-technical-details'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { AppLogsLoading } from '@/features/applications/viewer/logs/app-logs-content'
import { RuntimeToolsPanelLoading } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tools-panel'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { fullPermissions } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AppDeviceLayout } from './app-device-layout'
import { AppResourceBreadcrumbs } from './app-resource-breadcrumbs'
import { AppConfigurationSummary } from './app-resource-home'
import { AppResourceLayout, AppResourceOverviewLayout } from './app-resource-layout'
import { AppResourceNavigation } from './app-resource-navigation'
import { AppViewerPaneLayout } from './app-viewer-pane'
import type { AppResourceView } from '@/shared/model/applications/app-resource-links'

const noop = () => undefined

const DeviceSkeleton = () => (
  <AppViewerPaneLayout placement='top'>
    <div className='flex h-[var(--app-viewer-height)] w-full items-start justify-center gap-2 overflow-hidden p-2'>
      <div className='w-full max-w-[calc((var(--app-viewer-height)-var(--viewer-chrome-height)-1rem)*0.47)] overflow-hidden rounded-panel'>
        <Skeleton className='h-[var(--viewer-chrome-height)] w-full rounded-none' />
        <Skeleton className='aspect-[0.47] w-full rounded-none' />
      </div>
      <div className='grid shrink-0 gap-1.5'>
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton
            key={index}
            className='size-[var(--viewer-rail-width)]'
          />
        ))}
      </div>
    </div>
  </AppViewerPaneLayout>
)

const LoadingAppLayout = ({ view = 'overview', children }: { view?: AppResourceView; children: React.ReactNode }) => {
  const configuration = view === 'configuration'
  return (
    <AppDeviceLayout
      breadcrumbs={<AppResourceBreadcrumbs view={view} />}
      viewer={<DeviceSkeleton />}
      contained={view === 'ai-agent'}
      loading
    >
      <StandardPage className={view === 'ai-agent' ? 'lg:h-full lg:min-h-0' : undefined}>
        <AppResourceLayout
          workspace={view === 'ai-agent'}
          heading={
            <AppViewerHeading
              loading
              showStatusBadge
            >
              {configuration ? (
                <>
                  <AppConfigurationMenu />
                  <Button disabled>
                    <IconDeviceFloppy className='size-4' />
                    Save
                  </Button>
                </>
              ) : view === 'network' ? null : (
                <Button disabled>
                  <IconPlayerPlay className='size-4' />
                  Start
                </Button>
              )}
            </AppViewerHeading>
          }
          navigation={
            <AppResourceNavigation
              appId=''
              canViewAuditActivity
              active={view}
              permissions={fullPermissions}
              isForeignOwnedApp={false}
              loading
            />
          }
          status={null}
        >
          {children}
        </AppResourceLayout>
      </StandardPage>
    </AppDeviceLayout>
  )
}

const AppOverviewSkeleton = () => (
  <LoadingAppLayout>
    <AppResourceOverviewLayout summary={<AppConfigurationSummary loading />} />
  </LoadingAppLayout>
)

export const AppManagePageSkeleton = () => {
  const values = getInitialCreateAppFormValues(defaultOrchestratorUiSettings)
  return (
    <LoadingAppLayout view='configuration'>
      <FormLoadingBoundary>
        <EditorPage className='gap-6 pb-16'>
          <AppIdentitySection
            valuesName=''
            onNameChange={noop}
            nameDescription='Display name shown in the UI for this app. Minimum 2 characters.'
            isUploadingApk={false}
            onApkSelect={noop}
            iconSlot={
              <AppFormIconSection
                appName=''
                iconPreview={null}
                autoExtractIcon={false}
                hasExtractedIcon={false}
                disabled
                showDescription={false}
                showAutoExtract={false}
                onIconChange={noop}
                onClearIcon={noop}
                onAutoExtractIconChange={noop}
              />
            }
          />
          <AppManageRuntimeSettings
            values={values}
            resourceLimits={null}
            onChange={noop}
            canChangeSessionLimit
            canChangeResources
            canChangeContainerArgs
            canViewBackendDetails
          />
        </EditorPage>
      </FormLoadingBoundary>
    </LoadingAppLayout>
  )
}

export const AppProfilesPageSkeleton = () => (
  <AppDeviceLayout
    breadcrumbs={<AppResourceBreadcrumbs view='profiles' />}
    viewer={<DeviceSkeleton />}
    loading
  >
    <EditorPage>
      <PageContent>
        <AppViewerHeading loading />
        <AppProfilesSection
          profiles={[]}
          onRemove={noop}
          loading
        />
      </PageContent>
    </EditorPage>
  </AppDeviceLayout>
)

export const AppPageSkeleton = ({ activity }: { activity?: React.ReactNode } = {}) => (
  <Suspense fallback={<AppOverviewSkeleton />}>
    <AppRouteSkeleton activity={activity} />
  </Suspense>
)

const AppRouteSkeleton = ({ activity }: { activity?: React.ReactNode }) => {
  const view = useSearchParams().get('view')
  if (view === 'configuration') return <AppManagePageSkeleton />
  if (view === 'network')
    return (
      <LoadingAppLayout view='network'>
        <FormLoadingBoundary>
          <EditorPage>
            <AppNetworkPolicySettingsLoading />
          </EditorPage>
        </FormLoadingBoundary>
      </LoadingAppLayout>
    )
  if (view === 'profiles') return <AppProfilesPageSkeleton />
  if (view === 'diagnostics')
    return (
      <LoadingAppLayout view='diagnostics'>
        <AppManageTechnicalDetails loading />
        <Section
          surface='band'
          title='Application logs'
          description='Inspect startup output and Android logs.'
        >
          <AppLogsLoading />
        </Section>
      </LoadingAppLayout>
    )
  if (view === 'activity')
    return <LoadingAppLayout view='activity'>{activity ?? <Skeleton className='h-80 w-full' />}</LoadingAppLayout>
  if (view === 'ai-agent' || view === 'workflows' || view === 'files')
    return (
      <LoadingAppLayout view={view}>
        <RuntimeToolsPanelLoading toolId={view} />
      </LoadingAppLayout>
    )
  return <AppOverviewSkeleton />
}
