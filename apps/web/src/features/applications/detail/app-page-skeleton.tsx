'use client'

import { Suspense } from 'react'
import {
  IconAdjustments,
  IconDatabase,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconRobot,
  IconTrash
} from '@tabler/icons-react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { AppIdentitySection } from '@/features/applications/components/app-identity-section'
import { AppNetworkPolicyEditorSection } from '@/features/applications/components/app-network-policy-editor-section'
import { getInitialCreateAppFormValues } from '@/features/applications/create/create-app-form-model'
import { AppFormIconSection } from '@/features/applications/create/create-app-icon-section'
import { AppProfilesSection } from '@/features/applications/manage/app-manage-profiles'
import { AppManageRuntimeSettings } from '@/features/applications/manage/app-manage-runtime-settings'
import { AppManageTechnicalDetails } from '@/features/applications/manage/app-manage-technical-details'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { AppLogsLoading } from '@/features/applications/viewer/logs/app-logs-content'
import { RuntimeToolsPanelLoading } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tools-panel'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { fullPermissions } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AppDeviceLayout } from './app-device-layout'
import { AppConfigurationSummary } from './app-resource-home'
import { AppResourceLayout, AppResourceOverviewLayout } from './app-resource-layout'
import { type AppResourceView, appResourceLabels } from './app-resource-links'
import { AppResourceNavigation } from './app-resource-navigation'
import { AppViewerPaneLayout } from './app-viewer-pane'

const noop = () => undefined

const DeviceSkeleton = () => (
  <AppViewerPaneLayout placement='top'>
    <div className='flex w-full shrink-0 justify-end'>
      <Button
        variant='ghost'
        size='sm'
        disabled
      >
        <IconAdjustments className='size-4' />
        Streaming settings
      </Button>
    </div>
    <Skeleton className='h-[var(--app-viewer-height)] w-full max-w-[calc(var(--app-viewer-height)*0.47)] rounded-feature' />
  </AppViewerPaneLayout>
)

const LoadingAppLayout = ({ view = 'overview', children }: { view?: AppResourceView; children: React.ReactNode }) => {
  const configuration = view === 'configuration'
  return (
    <AppDeviceLayout
      viewer={<DeviceSkeleton />}
      contained={view === 'ai-agent'}
    >
      <StandardPage className={view === 'ai-agent' ? 'lg:h-full lg:min-h-0' : undefined}>
        <AppResourceLayout
          workspace={view === 'ai-agent'}
          breadcrumbs={
            <PageBreadcrumbs
              items={[
                { label: 'Apps', href: '/apps' },
                { label: 'Application' },
                ...(view !== 'overview' ? [{ label: appResourceLabels[view] }] : [])
              ]}
            />
          }
          heading={
            <AppViewerHeading
              loading
              showStatusBadge={!configuration}
            >
              <div className='flex flex-wrap gap-2'>
                {configuration ? (
                  <>
                    <Button
                      variant='secondary'
                      disabled
                    >
                      <IconDatabase className='size-4' />
                      Profiles
                    </Button>
                    <Button
                      variant='danger'
                      disabled
                    >
                      <IconTrash className='size-4' />
                      Delete app
                    </Button>
                    <Button disabled>
                      <IconDeviceFloppy className='size-4' />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button disabled>
                      <IconPlayerPlay className='size-4' />
                      Start
                    </Button>
                    <Button
                      variant='secondary'
                      disabled
                    >
                      <IconRobot className='size-4' />
                      Run workflow
                    </Button>
                  </>
                )}
              </div>
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
    <AppResourceOverviewLayout
      summary={<AppConfigurationSummary loading />}
      actions={
        <Section
          surface='plain'
          title='Next actions'
          orientation='horizontal'
          contentClassName='flex-wrap gap-3'
        >
          <Button disabled>Open viewer</Button>
          <Button
            variant='outline'
            disabled
          >
            Edit configuration
          </Button>
          <Button
            variant='outline'
            disabled
          >
            Inspect diagnostics
          </Button>
          <Button
            variant='outline'
            disabled
          >
            Related workflows
          </Button>
        </Section>
      }
    />
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
          <AppNetworkPolicyEditorSection
            title='Network access'
            modeValue={false}
            onModeChange={noop}
            allowCidrs={[]}
            onAddCidr={noop}
            onRemoveCidr={noop}
            onInvalidCidr={noop}
            isBusy
            modeDescription='Choose whether Android traffic is limited to the API and explicit CIDR ranges.'
            sectionActions={
              <>
                <Button disabled>Save policy</Button>
                <Button
                  variant='secondary'
                  disabled
                >
                  Apply now
                </Button>
              </>
            }
          />
        </EditorPage>
      </FormLoadingBoundary>
    </LoadingAppLayout>
  )
}

export const AppProfilesPageSkeleton = () => (
  <AppDeviceLayout viewer={<DeviceSkeleton />}>
    <EditorPage>
      <PageContent>
        <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: 'Application' }, { label: 'Profiles' }]} />
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
  const tool = view === 'workspace' ? 'ai-agent' : view
  if (tool === 'ai-agent' || tool === 'workflows' || tool === 'clipboard' || tool === 'files')
    return (
      <LoadingAppLayout view={tool}>
        <RuntimeToolsPanelLoading toolId={tool} />
      </LoadingAppLayout>
    )
  return <AppOverviewSkeleton />
}
