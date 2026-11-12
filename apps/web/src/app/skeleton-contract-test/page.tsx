import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { CreateAppPageLoading } from '@/features/applications/create/create-app-page-loading'
import { CreateAppPreview } from '@/features/applications/create/create-app-preview'
import { AppPageSkeleton, AppProfilesPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { AppResourcePreview } from '@/features/applications/detail/app-resource-preview'
import { appResourcePreviewFeatures } from '@/features/applications/detail/app-resource-preview-data'
import { AppsGalleryPreview } from '@/features/applications/list/apps-gallery-preview'
import { AppsPageSkeleton } from '@/features/applications/list/apps-page-skeleton'
import {
  AutomationCreatePageSkeleton,
  AutomationEditorPageSkeleton,
  AutomationsListPageSkeleton,
  AutomationTriggersPageSkeleton,
  AutomationTracesPageSkeleton
} from '@/features/automations/automations-page/automation-page-skeletons'
import { WorkflowEditorPreview } from '@/features/automations/automations-page/editor/workflow-editor-preview'
import { AutomationsListPage } from '@/features/automations/automations-page/list/automations-list-page'
import { AutomationRunPreview } from '@/features/automations/automations-page/traces/automation-run-preview'
import { AutomationTracesPage } from '@/features/automations/automations-page/traces/automation-traces-page'
import {
  previewTrigger,
  AutomationTriggersPreview
} from '@/features/automations/automations-page/triggers/automation-triggers-preview'
import { ActiveWorkflowRunsPage } from '@/features/automations/pages/active-workflow-runs/active-workflow-runs-page'
import { PlatformOperationsPreview } from '@/features/platform/components/platform-operations-preview'
import { PlatformOverviewPageClient } from '@/features/platform/components/platform-overview-page-client'
import { PlatformOverviewPageSkeleton } from '@/features/platform/components/platform-overview-page-skeleton'
import { RuntimeContainerDetailPageLoading } from '@/features/platform/components/platform-page-skeletons/platform-container-detail-page-skeleton'
import {
  RuntimeImageDetailPageLoading,
  RuntimeNetworkDetailPageLoading
} from '@/features/platform/components/platform-page-skeletons/platform-resource-detail-page-skeleton'
import { SkeletonContractFixture } from '@/features/platform/components/skeleton-contract-fixture'
import { FirewallPageClient } from '@/features/platform/pages/firewall/page-client'
import { FirewallPageLoading } from '@/features/platform/pages/firewall/page-loading'
import { ImageBuilderPreview } from '@/features/platform/pages/runtime-image-builder/image-builder-preview'
import {
  FeaturesPreview,
  OcrServiceSettingsPreview,
  ServicesPreview,
  InfrastructureServicePreview,
  servicesPreviewHealth,
  servicesPreviewManifest
} from '@/features/platform/services/services-preview'
import { AppActivityLoading, ActivityPageSkeleton } from '@/features/settings/activity/activity-page-skeleton'
import { CastingSettingsPageClient } from '@/features/settings/casting/casting-settings-page-client'
import { CastingPageLoading } from '@/features/settings/casting/pages/casting/page-skeleton'
import {
  AiProvidersPageSkeleton,
  AiProviderEditPageSkeleton
} from '@/features/settings/orchestrator/ai-providers/ai-provider-page-skeletons'
import { AiProvidersPreview } from '@/features/settings/orchestrator/ai-providers/ai-providers-preview'
import { PlatformRuntimePageSkeleton } from '@/features/settings/orchestrator/platform-runtime-page-skeleton'
import { PlatformRuntimeUnavailable } from '@/features/settings/orchestrator/platform-runtime-unavailable'
import { RuntimeSettingsPreview } from '@/features/settings/orchestrator/runtime-settings-preview'
import { ScheduledTasksPageSkeleton } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-page-skeleton'
import { ScheduledTasksPreview } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-preview'
import { SystemResourcesContent } from '@/features/settings/system/system-resources-content'
import { SystemResourcesPageSkeleton } from '@/features/settings/system/system-resources-page-skeleton'
import { UserEditorPreview } from '@/features/settings/users/user-editor-preview'
import {
  UsersPageSkeleton,
  GroupsPageSkeleton,
  UserEditPageSkeleton,
  GroupEditPageSkeleton
} from '@/features/settings/users/user-page-skeletons'
import { ConsoleShellPreview } from '@/features/shell/components/console-shell-preview'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { parseSidebarCollapsed, sidebarCollapsedCookie } from '@/shared/model/settings/sidebar-preference'
import { applicationPreview } from '@/shared/testing/application-preview'
import { previewWorkflow } from '@/shared/testing/automation-preview'
import { FeedbackPreview } from '@/shared/testing/feedback-preview'
import { PageFailurePreview } from '@/shared/testing/page-failure-preview'
import {
  AppActivityPreview,
  AuditLogPreview,
  GeneralSettingsPreview,
  SecuritySettingsPreview,
  ConsoleDefaultsPreview,
  ResourceChartsPreview,
  UsersListPreview
} from './preview-compositions'

export const dynamic = 'force-dynamic'

export default async function SkeletonContractPage({
  searchParams
}: {
  searchParams: Promise<{ editor?: string; workflows?: string }>
}) {
  if (process.env.ENABLE_SKELETON_CONTRACT_ROUTE !== '1') notFound()

  const { editor, workflows } = await searchParams
  if (editor === 'services-unavailable') return <ServicesPreview unavailable />
  if (editor === 'resources-unavailable')
    return (
      <SystemResourcesContent
        systemError
        resourcesError
      />
    )
  if (editor === 'display-offline' || editor === 'display-sessions' || editor === 'display-published-ports')
    return (
      <CastingSettingsPageClient
        containerId={editor === 'display-sessions' ? 'preview-display-container' : undefined}
        initialHealth={
          editor === 'display-offline'
            ? { ok: false, status: 'offline', message: 'Display service is offline.' }
            : {
                ok: true,
                status: 'healthy',
                message: 'Display sidecar API is responding.',
                details: {
                  containerName: 'rebroid-display-sidecar',
                  image: 'rebroid/display-sidecar:local',
                  port: 4300,
                  publishedHostPort:
                    editor === 'display-published-ports'
                      ? Array.from({ length: 120 }, (_, index) => 40000 + index).join(', ')
                      : null
                }
              }
        }
        initialSessions={[]}
        applications={[]}
        owners={[]}
      />
    )
  if (editor === 'runtime-unavailable') return <PlatformRuntimeUnavailable />
  if (editor === 'service-docker-unavailable')
    return (
      <InfrastructureServicePreview
        serviceId='docker'
        unavailable
      />
    )
  if (editor === 'failure-unavailable') return <PageFailurePreview kind='unavailable' />
  if (editor === 'failure-not-found') return <PageFailurePreview kind='not-found' />
  if (editor === 'failure-error') return <PageFailurePreview kind='error' />
  if (editor === 'feedback') return <FeedbackPreview />
  if (editor === 'app-loading')
    return (
      <main className='min-h-screen bg-background pt-(--console-top-inset)'>
        <FeatureFlagsProvider manifest={appResourcePreviewFeatures}>
          <CreateAppPageLoading />
        </FeatureFlagsProvider>
      </main>
    )
  if (editor === 'app-resource-loading')
    return (
      <main className='min-h-screen bg-background pt-(--console-top-inset)'>
        <FeatureFlagsProvider manifest={appResourcePreviewFeatures}>
          <AppPageSkeleton activity={<AppActivityLoading />} />
        </FeatureFlagsProvider>
      </main>
    )
  if (editor === 'app-profiles-loading')
    return (
      <main className='min-h-screen bg-background pt-(--console-top-inset)'>
        <AppProfilesPageSkeleton />
      </main>
    )
  if (editor === 'apps-gallery') return <AppsGalleryPreview />
  if (editor === 'apps-gallery-loading') return <AppsPageSkeleton />
  if (editor === 'overview') return <PlatformOverviewPageClient />
  if (editor === 'active-workflow-runs')
    return (
      <ActiveWorkflowRunsPage
        runs={[
          {
            id: 'run-queued',
            automationId: 'workflow-1',
            workflowName: 'Inventory scan',
            targetApplicationId: 'preview-app',
            createdAt: '2026-11-12T12:30:00Z',
            status: 'queued'
          },
          {
            id: 'run-running',
            automationId: 'workflow-2',
            workflowName: 'Order sync',
            targetApplicationId: 'preview-app',
            createdAt: '2026-11-12T12:00:00Z',
            status: 'running'
          }
        ]}
        targets={{ 'preview-app': 'Warehouse scanner' }}
      />
    )
  if (editor === 'workflow') return <WorkflowEditorPreview />
  if (editor === 'agent') return <AppResourcePreview agent />
  if (editor === 'workflow-create') return <WorkflowEditorPreview creating />
  if (editor === 'workflow-loading') return <AutomationEditorPageSkeleton />
  if (editor === 'workflow-create-loading') return <AutomationCreatePageSkeleton />
  if (editor === 'workflows')
    return (
      <AutomationsListPage
        initialApplications={[applicationPreview]}
        initialTriggers={[previewTrigger]}
        automationsPage={{
          items: [
            {
              ...previewWorkflow,
              tags: [{ name: 'Inventory', color: '#2563eb' }],
              lastStatus: 'failed',
              lastRunAt: '2026-11-07T10:00:00Z',
              lastRunId: 'preview-run'
            }
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          facets: { tags: [], targetApplicationIds: [applicationPreview.id] }
        }}
        gridQuery={{}}
      />
    )
  if (editor === 'run-history')
    return (
      <AutomationTracesPage
        applications={[applicationPreview]}
        automation={previewWorkflow}
        runs={[]}
      />
    )
  if (editor === 'workflows-loading') return <AutomationsListPageSkeleton />
  if (editor === 'triggers-loading') return <AutomationTriggersPageSkeleton />
  if (editor === 'run-history-loading') return <AutomationTracesPageSkeleton />
  if (editor === 'overview-loading') return <PlatformOverviewPageSkeleton />
  if (editor === 'container-loading') return <RuntimeContainerDetailPageLoading />
  if (editor === 'image-loading') return <RuntimeImageDetailPageLoading />
  if (editor === 'network-loading') return <RuntimeNetworkDetailPageLoading />
  if (editor === 'activity') return <AuditLogPreview />
  if (editor === 'activity-loading') return <ActivityPageSkeleton />
  if (editor === 'display-sessions-loading') return <CastingPageLoading />
  if (editor === 'resources-loading') return <SystemResourcesPageSkeleton />
  if (editor === 'users-list-loading') return <UsersPageSkeleton />
  if (editor === 'groups-list-loading') return <GroupsPageSkeleton />
  if (editor === 'user-loading') return <UserEditPageSkeleton />
  if (editor === 'group-loading') return <GroupEditPageSkeleton />
  if (editor === 'ai-connection-loading') return <AiProviderEditPageSkeleton />

  if (editor === 'console-shell') {
    const requestCookies = await cookies()
    const manifest = workflows === '1' ? servicesPreviewManifest() : undefined
    return (
      <ConsoleShellPreview
        initialSidebarCollapsed={parseSidebarCollapsed(requestCookies.get(sidebarCollapsedCookie)?.value)}
        manifest={
          manifest && {
            ...manifest,
            features: manifest.features.filter(feature => feature.key === 'feature.workflows')
          }
        }
      />
    )
  }
  if (editor === 'triggers') return <AutomationTriggersPreview />
  if (editor === 'policies-loading')
    return (
      <FeatureFlagsProvider manifest={servicesPreviewManifest(true)}>
        <FirewallPageLoading />
      </FeatureFlagsProvider>
    )
  if (editor === 'policies' || editor === 'service-firewall')
    return (
      <FeatureFlagsProvider manifest={servicesPreviewManifest(true)}>
        <FirewallPageClient
          initialApplications={[applicationPreview]}
          initialSettings={defaultOrchestratorUiSettings.services.firewall}
          initialHealth={
            editor === 'service-firewall'
              ? servicesPreviewHealth.services.firewall
              : { ok: true, status: 'healthy', message: 'Network policy agent is responding.' }
          }
        />
      </FeatureFlagsProvider>
    )
  if (editor?.startsWith('builder-gapps'))
    return (
      <ImageBuilderPreview
        mode='gapps'
        state={editor.slice('builder-gapps-'.length)}
      />
    )
  if (editor?.startsWith('builder-custom'))
    return (
      <ImageBuilderPreview
        mode='custom'
        state={editor.slice('builder-custom-'.length)}
      />
    )
  if (editor === 'ai-list') return <AiProvidersPreview view='list' />
  if (editor === 'ai-models') return <AiProvidersPreview view='models' />
  if (editor === 'ai-connection') return <AiProvidersPreview view='connection' />
  if (editor === 'ai-list-loading') return <AiProvidersPageSkeleton />
  if (editor === 'ai-models-loading') return <AiProviderEditPageSkeleton />
  if (editor === 'users-list') return <UsersListPreview />
  if (editor === 'general' || editor === 'general-loading' || editor === 'general-member')
    return <GeneralSettingsPreview loading={editor === 'general-loading'} />
  if (editor === 'security' || editor === 'security-loading')
    return <SecuritySettingsPreview loading={editor === 'security-loading'} />
  if (editor === 'console-defaults' || editor === 'console-defaults-loading')
    return <ConsoleDefaultsPreview loading={editor === 'console-defaults-loading'} />
  if (editor === 'user' || editor === 'group') return <UserEditorPreview kind={editor} />
  if (editor === 'scheduler') return <ScheduledTasksPreview />
  if (editor === 'scheduler-loading') return <ScheduledTasksPageSkeleton />
  if (editor === 'service-docker' || editor === 'service-orchestrator')
    return <InfrastructureServicePreview serviceId={editor === 'service-docker' ? 'docker' : 'orchestrator'} />
  if (editor === 'service-ocr') return <OcrServiceSettingsPreview />
  if (editor === 'services' || editor === 'services-all') return <ServicesPreview all={editor === 'services-all'} />
  if (editor === 'features') return <FeaturesPreview />
  if (editor === 'features-loading') return <FeaturesPreview loading />
  if (editor === 'service-route-loading') return <ServicesPreview loading />
  if (editor === 'services-loading') return <ServicesPreview loading />
  if (editor === 'services-all-loading')
    return (
      <ServicesPreview
        all
        loading
      />
    )
  if (editor === 'operations') return <PlatformOperationsPreview />
  if (editor === 'runtime') return <RuntimeSettingsPreview />
  if (editor === 'runtime-loading') return <PlatformRuntimePageSkeleton />
  if (editor === 'app-resource') return <AppResourcePreview activity={<AppActivityPreview />} />
  if (editor === 'failed-run') return <AutomationRunPreview />
  if (editor === 'app')
    return (
      <FeatureFlagsProvider manifest={appResourcePreviewFeatures}>
        <CreateAppPreview />
      </FeatureFlagsProvider>
    )
  return <SkeletonContractFixture Charts={ResourceChartsPreview} />
}
