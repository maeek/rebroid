import type { ElementType } from 'react'
import {
  IconAdjustments,
  IconApps,
  IconBox,
  IconBrandDocker,
  IconCalendarTime,
  IconChartHistogram,
  IconHistory,
  IconNetwork,
  IconPlugConnected,
  IconRobot,
  IconServerSpark,
  IconShield,
  IconToggleLeft,
  IconUsers
} from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import type { FeatureFlagKey } from '@/shared/contracts/feature-flags'

export type NavigationVariant = 'sidebar' | 'rail' | 'drawer'

export type NavigationItem = {
  name: string
  href: string
  Icon: ElementType<{ className?: string }>
  feature?: FeatureFlagKey
  shortcut?: { href: string; label: string; feature?: FeatureFlagKey }
}

export const appSections: NavigationItem[] = [{ name: 'All apps', Icon: IconApps, href: '/apps' }]

export const automationSections: NavigationItem[] = [
  { name: 'Workflows', Icon: IconRobot, href: '/automations' },
  { name: 'Triggers', Icon: IconCalendarTime, href: '/automations/triggers' }
]

export const securitySections: NavigationItem[] = [
  {
    name: 'Users',
    Icon: IconUsers,
    href: '/security/users',
    shortcut: { href: '/security/users?create=1', label: 'Create user' }
  },
  {
    name: 'Groups',
    Icon: IconShield,
    href: '/security/groups',
    shortcut: { href: '/security/groups?create=1', label: 'Create group' }
  },
  { name: 'Network policies', Icon: IconNetwork, href: '/security/network-policies', feature: 'feature.firewall' },
  { name: 'Audit log', Icon: IconHistory, href: '/security/audit-log' }
]

export const overviewSections: NavigationItem[] = [{ name: 'Overview', Icon: IconChartHistogram, href: '/platform' }]

export const platformSections: NavigationItem[] = [
  { name: 'Runtime defaults', Icon: IconAdjustments, href: '/platform/runtime' },
  { name: 'Services', Icon: IconPlugConnected, href: '/platform/services' },
  { name: 'Features', Icon: IconToggleLeft, href: '/platform/features' },
  { name: 'Scheduler', Icon: IconCalendarTime, href: '/platform/scheduler' },
  { name: 'AI', Icon: GradientSparklesIcon, href: '/platform/ai', feature: 'feature.ai' }
]

export const runtimeSections: NavigationItem[] = [
  { name: 'Containers', Icon: IconBox, href: '/runtime/containers' },
  {
    name: 'Images',
    Icon: IconBrandDocker,
    href: '/runtime/images',
    shortcut: { href: '/runtime/images/build', label: 'Build image', feature: 'feature.image-builder' }
  },
  { name: 'Networks', Icon: IconNetwork, href: '/runtime/networks' }
]

export const systemSections: NavigationItem[] = [
  { name: 'Resources', Icon: IconServerSpark, href: '/system/resources' }
]

export const preferenceSections: NavigationItem[] = [
  { name: 'General', Icon: IconAdjustments, href: '/preferences/general' }
]

export const variantStyles = {
  sidebar: {
    root: 'w-full py-4 flex flex-col px-3',
    sectionHeader: 'flex min-h-6 items-center justify-between gap-2 px-2 pb-1',
    sectionTitle: 'text-xs font-medium text-foreground-muted max-lg:text-xs',
    sectionAction:
      'flex size-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition hover:bg-primary/15 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    sectionActionIcon: 'size-4 stroke-current',
    list: 'flex w-full flex-col gap-0.5 pb-4',
    item: 'flex gap-2 justify-start items-center px-2 py-1 hover:bg-control-hover rounded-control text-foreground cursor-pointer',
    activeItem: 'bg-accent text-accent-foreground!',
    iconWrap: 'size-6 rounded-control flex shrink-0 justify-center items-center',
    icon: 'size-4.5 stroke-current',
    label: 'text-sm max-lg:text-inherit',
    nestedList: 'ml-5 min-h-0 space-y-0.5 border-l border-surface-border py-1 pl-2',
    nestedItem:
      'flex min-w-0 items-center gap-2 rounded-control px-2 py-1 text-sm text-foreground-muted transition hover:bg-control-hover hover:text-foreground',
    nestedActiveItem: 'bg-accent text-accent-foreground!',
    nestedIconWrap: 'flex size-6 shrink-0 items-center justify-center rounded-control',
    nestedIcon: 'size-4 stroke-current',
    toggleButton:
      'mr-1 flex size-8 items-center justify-center rounded-control text-foreground-muted transition hover:bg-accent/70 hover:text-foreground',
    dashboardSpacing: ''
  },
  rail: {
    root: 'flex w-full flex-col px-2 py-4',
    sectionHeader: 'flex justify-center has-[a]:mb-1',
    sectionTitle: 'sr-only',
    sectionAction:
      'touch-control flex size-8 shrink-0 items-center justify-center rounded-control text-foreground-muted hover:bg-control-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
    sectionActionIcon: 'size-4 stroke-current',
    list: 'grid justify-items-center gap-1 mb-3 border-b border-surface-border/60 pb-3 last:mb-0 last:border-b-0',
    item: 'touch-control flex size-9 shrink-0 items-center justify-center rounded-control text-foreground hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-ring',
    activeItem: 'bg-accent text-accent-foreground!',
    iconWrap: 'flex size-6 shrink-0 items-center justify-center',
    icon: 'size-4.5 stroke-current',
    label: 'sr-only'
  },
  drawer: {
    root: 'flex flex-col p-4',
    sectionHeader: 'flex items-center justify-between gap-2 px-2 pb-4',
    sectionTitle: 'text-sm font-medium text-foreground-muted max-lg:text-sm',
    sectionAction:
      'touch-control flex size-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition hover:bg-control hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    sectionActionIcon: 'size-4 stroke-current',
    list: 'w-full pb-6 flex flex-col',
    item: 'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-control-hover rounded-control text-foreground hover:text-foreground cursor-pointer',
    activeItem: 'bg-control',
    iconWrap: 'size-8 rounded-control flex shrink-0 justify-center items-center',
    icon: 'size-5 max-lg:size-5 stroke-current',
    label: 'text-base max-lg:text-inherit text-inherit',
    nestedList: 'min-h-0 space-y-1 py-1 pl-8',
    nestedItem:
      'touch-control flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-control-hover rounded-control text-foreground hover:text-foreground cursor-pointer',
    nestedActiveItem: 'bg-control',
    nestedIconWrap: 'flex size-7 shrink-0 items-center justify-center rounded-control',
    nestedIcon: 'size-4 stroke-current',
    toggleButton:
      'mr-1 flex size-8 items-center justify-center rounded-control text-foreground-muted transition hover:bg-control hover:text-foreground',
    dashboardSpacing: 'mb-4'
  }
} as const

export const isNavigationDestinationActive = (pathname: string, href: string, exact = false) =>
  exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
