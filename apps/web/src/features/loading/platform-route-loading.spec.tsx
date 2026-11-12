import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeaturesPageLoading } from '@/features/platform/features/features-page'
import { PlatformServicesPageSkeleton } from '@/features/platform/services/services-page-skeleton'
import { servicesPreviewManifest } from '@/features/platform/services/services-preview'
import { CastingPageLoading } from '@/features/settings/casting/pages/casting/page-skeleton'
import {
  AiProviderEditPageSkeleton,
  AiProvidersPageSkeleton
} from '@/features/settings/orchestrator/ai-providers/ai-provider-page-skeletons'
import { PlatformRuntimePageSkeleton } from '@/features/settings/orchestrator/platform-runtime-page-skeleton'
import { ScheduledTasksPageSkeleton } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-page-skeleton'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'

const navigation = vi.hoisted(() => ({ search: '' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/platform/services',
  useSearchParams: () => new URLSearchParams(navigation.search)
}))
vi.mock('nextjs-toploader', () => ({ useTopLoader: () => ({ start: vi.fn(), done: vi.fn() }) }))

const renderLoading = (node: ReactNode, search = '') => {
  navigation.search = search
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FeatureFlagsProvider manifest={servicesPreviewManifest()}>{node}</FeatureFlagsProvider>
    </QueryClientProvider>
  )
}

describe('platform destination loading states', () => {
  it('omits skeleton rows for optional services known to be disabled', () => {
    renderLoading(<PlatformServicesPageSkeleton />)

    expect(screen.getAllByTestId('data-grid-skeleton-row')).toHaveLength(3)
  })

  it.each([
    ['runtime', PlatformRuntimePageSkeleton, 'General', 'Image defaults', 'AdministrationGeneral'],
    ['scheduler', ScheduledTasksPageSkeleton, 'Maintenance tasks', 'Task', 'SystemMaintenance tasks'],
    ['features', FeaturesPageLoading, 'Feature management', 'OCR perception', 'AdministrationFeature management'],
    ['connections', PlatformServicesPageSkeleton, 'Services', 'Connection', 'SystemServices'],
    ['providers', AiProvidersPageSkeleton, 'AI', 'Providers', 'AdministrationAI'],
    ['casting', CastingPageLoading, 'Casting', 'Connection', 'AdministrationCasting']
  ] as const)('renders the %s page chrome instead of overview content', (_, Component, title, content, breadcrumb) => {
    renderLoading(<Component />)

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible()
    expect(screen.getByText(content, { exact: true })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toHaveTextContent(breadcrumb)
    expect(screen.queryByText('Recently opened')).toBeNull()
    expect(screen.queryByText('Apps needing attention')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Capacity' })).toBeNull()
  })

  it.each([
    ['docker', 'Docker', 'DockerOverview'],
    ['orchestrator', 'Orchestrator', 'SystemServicesOrchestrator'],
    ['ocr', 'OCR perception', 'SystemServicesOCR perception'],
    ['firewall', 'Firewall', 'AdministrationFirewall']
  ] as const)('selects the %s service loader from the destination query', (service, title, breadcrumb) => {
    renderLoading(<PlatformServicesPageSkeleton />, `service=${service}`)

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toHaveTextContent(breadcrumb)
    expect(screen.queryByRole('searchbox', { name: 'Search services' })).toBeNull()
  })

  it.each(['models', 'connection'] as const)(
    'selects the provider %s loader without showing the provider list',
    view => {
      renderLoading(<AiProviderEditPageSkeleton />, `view=${view}`)

      expect(screen.getByRole('navigation', { name: 'AI provider navigation' })).toBeVisible()
      if (view === 'connection') {
        expect(screen.getByText('Base URL')).toBeVisible()
        expect(screen.queryByRole('table')).toBeNull()
      } else {
        expect(screen.getByRole('heading', { name: 'Models' })).toBeVisible()
      }
      expect(screen.queryByRole('searchbox', { name: 'Search AI providers' })).toBeNull()
    }
  )
})
