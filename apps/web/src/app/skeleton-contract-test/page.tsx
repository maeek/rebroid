import { notFound } from 'next/navigation'
import { CreateAppPageLoading } from '@/features/applications/create/create-app-page-loading'
import { CreateAppPreview } from '@/features/applications/create/create-app-preview'
import { AppPageSkeleton, AppProfilesPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { AppResourcePreview } from '@/features/applications/detail/app-resource-preview'
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
import { PlatformOperationsPreview } from '@/features/platform/components/platform-operations-preview'
import { PlatformOverviewPageClient } from '@/features/platform/components/platform-overview-page-client'
import { PlatformOverviewPageSkeleton } from '@/features/platform/components/platform-overview-page-skeleton'
import { RuntimeContainerDetailPageLoading } from '@/features/platform/components/platform-page-skeletons/platform-container-detail-page-skeleton'
import {
  RuntimeImageDetailPageLoading,
  RuntimeNetworkDetailPageLoading
} from '@/features/platform/components/platform-page-skeletons/platform-resource-detail-page-skeleton'
import { SkeletonContractFixture } from '@/features/platform/components/skeleton-contract-fixture'
import { ImageBuilderPreview } from '@/features/platform/pages/runtime-image-builder/image-builder-preview'
import {
  FeaturesPreview,
  ServicesPreview,
  InfrastructureServicePreview
} from '@/features/platform/services/services-preview'
import { AppActivityLoading, ActivityPageSkeleton } from '@/features/settings/activity/activity-page-skeleton'
import { CastingSettingsPageClient } from '@/features/settings/casting/casting-settings-page-client'
import { PlatformDisplaySessionsPageSkeleton } from '@/features/settings/casting/pages/platform-display-sessions/page-skeleton'
import {
  AiProvidersPageSkeleton,
  AiProviderEditPageSkeleton
} from '@/features/settings/orchestrator/ai-providers/ai-provider-page-skeletons'
import { AiProvidersPreview } from '@/features/settings/orchestrator/ai-providers/ai-providers-preview'
import { FirewallSettingsPageClient } from '@/features/settings/orchestrator/firewall-settings-page-client'
import { SecurityNetworkPoliciesPageLoading } from '@/features/settings/orchestrator/firewall-settings-page-loading'
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
import { applicationPreview } from '@/shared/testing/application-preview'
import { previewWorkflow } from '@/shared/testing/automation-preview'
import { FeedbackPreview } from '@/shared/testing/feedback-preview'
import { PageFailurePreview } from '@/shared/testing/page-failure-preview'
import {
  AppActivityPreview,
  AuditLogPreview,
  GeneralSettingsPreview,
  ResourceChartsPreview,
  UsersListPreview
} from './preview-compositions'

export const dynamic = 'force-dynamic'

export default async function SkeletonContractPage({ searchParams }: { searchParams: Promise<{ editor?: string }> }) {
  if (process.env.ENABLE_SKELETON_CONTRACT_ROUTE !== '1') notFound()

  const editor = (await searchParams).editor
  if (editor === 'services-unavailable') return <ServicesPreview unavailable />
  if (editor === 'resources-unavailable')
    return (
      <SystemResourcesContent
        systemError
        resourcesError
      />
    )
  if (editor === 'display-offline')
    return (
      <CastingSettingsPageClient
        initialHealth={{ ok: false, status: 'offline', message: 'Display service is offline.' }}
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
      <main className='min-h-screen bg-background pt-16'>
        <CreateAppPageLoading />
      </main>
    )
  if (editor === 'app-resource-loading')
    return (
      <main className='min-h-screen bg-background pt-16'>
        <AppPageSkeleton activity={<AppActivityLoading />} />
      </main>
    )
  if (editor === 'app-profiles-loading')
    return (
      <main className='min-h-screen bg-background pt-16'>
        <AppProfilesPageSkeleton />
      </main>
    )
  if (editor === 'apps-gallery') return <AppsGalleryPreview />
  if (editor === 'apps-gallery-loading') return <AppsPageSkeleton />
  if (editor === 'overview') return <PlatformOverviewPageClient />
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
          items: [previewWorkflow],
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
  if (editor === 'display-sessions-loading') return <PlatformDisplaySessionsPageSkeleton />
  if (editor === 'resources-loading') return <SystemResourcesPageSkeleton />
  if (editor === 'users-list-loading') return <UsersPageSkeleton />
  if (editor === 'groups-list-loading') return <GroupsPageSkeleton />
  if (editor === 'user-loading') return <UserEditPageSkeleton />
  if (editor === 'group-loading') return <GroupEditPageSkeleton />
  if (editor === 'ai-connection-loading') return <AiProviderEditPageSkeleton />

  if (editor === 'console-shell') return <ConsoleShellPreview />
  if (editor === 'triggers') return <AutomationTriggersPreview />
  if (editor === 'policies-loading') return <SecurityNetworkPoliciesPageLoading />
  if (editor === 'policies')
    return (
      <FirewallSettingsPageClient
        initialApplications={[applicationPreview]}
        initialHealth={{ ok: true, status: 'healthy', message: 'Network policy agent is responding.' }}
      />
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
  if (editor === 'general' || editor === 'general-loading')
    return <GeneralSettingsPreview loading={editor === 'general-loading'} />
  if (editor === 'user' || editor === 'group') return <UserEditorPreview kind={editor} />
  if (editor === 'scheduler') return <ScheduledTasksPreview />
  if (editor === 'scheduler-loading') return <ScheduledTasksPageSkeleton />
  if (editor === 'service-docker' || editor === 'service-orchestrator')
    return <InfrastructureServicePreview serviceId={editor === 'service-docker' ? 'docker' : 'orchestrator'} />
  if (editor === 'services' || editor === 'services-all' || editor === 'services-edit')
    return (
      <ServicesPreview
        all={editor !== 'services'}
        editing={editor === 'services-edit'}
      />
    )
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
  if (editor === 'runtime-loading') return <RuntimeSettingsPreview loading />
  if (editor === 'app-resource') return <AppResourcePreview activity={<AppActivityPreview />} />
  if (editor === 'failed-run') return <AutomationRunPreview />
  if (editor === 'app') return <CreateAppPreview />
  return <SkeletonContractFixture Charts={ResourceChartsPreview} />
}
