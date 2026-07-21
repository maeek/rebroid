import type { ElementType } from 'react'
import {
  IconAdjustments,
  IconApps,
  IconBox,
  IconBrandDocker,
  IconCalendarTime,
  IconCast,
  IconChartHistogram,
  IconHistory,
  IconNetwork,
  IconPlugConnected,
  IconRobot,
  IconServerSpark,
  IconShield,
  IconUsers
} from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import type { FeatureFlagKey } from '@/shared/contracts/feature-flags'

export type NavigationVariant = 'sidebar' | 'drawer'

export type NavigationItem = {
  name: string
  href: string
  Icon: ElementType<{ className?: string }>
  feature?: FeatureFlagKey
}

export const appSections: NavigationItem[] = [{ name: 'Installed Apps', Icon: IconApps, href: '/apps' }]

export const automationSections: NavigationItem[] = [
  { name: 'Workflows', Icon: IconRobot, href: '/automations' },
  { name: 'Triggers', Icon: IconCalendarTime, href: '/automations/triggers' }
]

export const securitySections: NavigationItem[] = [
  { name: 'Users', Icon: IconUsers, href: '/security/users' },
  { name: 'Groups', Icon: IconShield, href: '/security/groups' },
  { name: 'Network policies', Icon: IconNetwork, href: '/security/network-policies', feature: 'feature.firewall' },
  { name: 'Audit log', Icon: IconHistory, href: '/security/audit-log' }
]

export const platformSections: NavigationItem[] = [
  { name: 'Overview', Icon: IconChartHistogram, href: '/platform' },
  { name: 'Runtime defaults', Icon: IconAdjustments, href: '/platform/runtime' },
  { name: 'AI', Icon: GradientSparklesIcon, href: '/platform/ai' },
  { name: 'Services', Icon: IconPlugConnected, href: '/platform/services' },
  { name: 'Features', Icon: IconAdjustments, href: '/platform/features' },
  { name: 'Display sessions', Icon: IconCast, href: '/platform/display-sessions' },
  { name: 'Scheduler', Icon: IconCalendarTime, href: '/platform/scheduler' }
]

export const runtimeSections: NavigationItem[] = [
  { name: 'Containers', Icon: IconBox, href: '/runtime/containers' },
  { name: 'Images', Icon: IconBrandDocker, href: '/runtime/images' },
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
    root: 'w-full py-6 flex flex-col px-2',
    sectionHeader: 'flex items-center justify-between gap-2 px-2 pb-2',
    sectionTitle: 'text-xs font-medium text-foreground-muted max-lg:text-xs',
    sectionAction:
      'flex size-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition hover:bg-primary/15 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    sectionActionIcon: 'size-4 stroke-current',
    list: 'w-full pb-4 flex flex-col',
    item: 'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-accent/70 rounded-control text-foreground hover:text-foreground cursor-pointer',
    activeItem: 'bg-accent/70 text-accent-foreground!',
    iconWrap: 'size-7 rounded-control flex shrink-0 justify-center items-center',
    icon: 'size-5 max-lg:size-4 stroke-current',
    label: 'text-sm max-lg:text-inherit',
    nestedList: 'min-h-0 space-y-1 py-1 pl-8',
    nestedItem:
      'flex items-center gap-2 rounded-control px-2 py-1 text-sm text-foreground-muted transition hover:bg-accent/70 hover:text-foreground',
    nestedActiveItem: 'bg-accent/70 text-accent-foreground!',
    nestedIconWrap: 'flex size-7 shrink-0 items-center justify-center rounded-control',
    nestedIcon: 'size-4 stroke-current',
    toggleButton:
      'mr-1 flex size-8 items-center justify-center rounded-control text-foreground-muted transition hover:bg-accent/70 hover:text-foreground',
    dashboardSpacing: ''
  },
  drawer: {
    root: 'flex flex-col p-4',
    sectionHeader: 'flex items-center justify-between gap-2 px-2 pb-4',
    sectionTitle: 'text-sm font-medium text-foreground-muted max-lg:text-sm',
    sectionAction:
      'flex size-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition hover:bg-control hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    sectionActionIcon: 'size-4 stroke-current',
    list: 'w-full pb-6 flex flex-col',
    item: 'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-control-hover rounded-control text-foreground hover:text-foreground cursor-pointer',
    activeItem: 'bg-control',
    iconWrap: 'size-8 rounded-control flex shrink-0 justify-center items-center',
    icon: 'size-5 max-lg:size-5 stroke-current',
    label: 'text-base max-lg:text-inherit text-inherit',
    nestedList: 'min-h-0 space-y-1 py-1 pl-8',
    nestedItem:
      'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-control-hover rounded-control text-foreground hover:text-foreground cursor-pointer',
    nestedActiveItem: 'bg-control',
    nestedIconWrap: 'flex size-7 shrink-0 items-center justify-center rounded-control',
    nestedIcon: 'size-4 stroke-current',
    toggleButton:
      'mr-1 flex size-8 items-center justify-center rounded-control text-foreground-muted transition hover:bg-control hover:text-foreground',
    dashboardSpacing: 'mb-4'
  }
} as const
