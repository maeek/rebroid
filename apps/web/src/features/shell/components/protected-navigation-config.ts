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
  IconRobot,
  IconServerSpark,
  IconShield,
  IconUsers
} from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'

export type NavigationVariant = 'sidebar' | 'drawer'

export type NavigationItem = {
  name: string
  href: string
  Icon: ElementType<{ className?: string }>
}

export const appSections: NavigationItem[] = [{ name: 'Installed Apps', Icon: IconApps, href: '/apps' }]

export const automationSections: NavigationItem[] = [
  { name: 'Workflows', Icon: IconRobot, href: '/automations' },
  { name: 'Triggers', Icon: IconCalendarTime, href: '/automations/triggers' }
]

export const userSections: NavigationItem[] = [
  { name: 'Users', Icon: IconUsers, href: '/users' },
  { name: 'Groups', Icon: IconShield, href: '/users/groups' }
]

export const orchestratorSections: NavigationItem[] = [
  { name: 'Overview', Icon: IconChartHistogram, href: '/orchestrator' },
  { name: 'Settings', Icon: IconAdjustments, href: '/orchestrator/settings' },
  { name: 'AI', Icon: GradientSparklesIcon, href: '/orchestrator/ai-providers' }
]

export const infrastructureSections: NavigationItem[] = [
  { name: 'Containers', Icon: IconBox, href: '/infrastructure/containers' },
  { name: 'Images', Icon: IconBrandDocker, href: '/infrastructure/images' },
  { name: 'Networks', Icon: IconNetwork, href: '/infrastructure/networks' },
  { name: 'System', Icon: IconServerSpark, href: '/infrastructure/system' }
]

export const operationsSections: NavigationItem[] = [
  { name: 'Casting', Icon: IconCast, href: '/operations/casting' },
  { name: 'Network access', Icon: IconNetwork, href: '/operations/network-access' },
  { name: 'Scheduled tasks', Icon: IconCalendarTime, href: '/operations/scheduled-tasks' },
  { name: 'Activity', Icon: IconHistory, href: '/operations/activity' }
]

export const preferenceSections: NavigationItem[] = [
  { name: 'General', Icon: IconAdjustments, href: '/preferences/general' }
]

export const variantStyles = {
  sidebar: {
    root: 'w-full py-6 flex flex-col px-2',
    sectionHeader: 'flex items-center justify-between gap-2 px-2 pb-2',
    sectionTitle: 'text-[10px] font-semibold color-secondary max-lg:text-xs',
    sectionAction:
      'flex size-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition hover:bg-primary/15 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    sectionActionIcon: 'size-4 stroke-current',
    list: 'w-full pb-4 flex flex-col',
    item: 'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-accent/70 rounded-sm text-foreground hover:text-foreground cursor-pointer',
    activeItem: 'bg-accent/70 text-accent-foreground!',
    iconWrap: 'size-7 rounded-sm flex shrink-0 justify-center items-center',
    icon: 'size-5 max-lg:size-4 stroke-current',
    label: 'text-sm max-lg:text-inherit',
    nestedList: 'min-h-0 space-y-1 py-1 pl-8',
    nestedItem:
      'flex items-center gap-2 rounded-sm px-2 py-1 text-sm text-foreground-muted transition hover:bg-accent/70 hover:text-foreground',
    nestedActiveItem: 'bg-accent/70 text-accent-foreground!',
    nestedIconWrap: 'flex size-7 shrink-0 items-center justify-center rounded-sm',
    nestedIcon: 'size-4 stroke-current',
    toggleButton:
      'mr-1 flex size-8 items-center justify-center rounded-sm text-foreground-muted transition hover:bg-accent/70 hover:text-foreground',
    dashboardSpacing: ''
  },
  drawer: {
    root: 'flex flex-col p-4',
    sectionHeader: 'flex items-center justify-between gap-2 px-2 pb-4',
    sectionTitle: 'text-sm font-semibold color-secondary max-lg:text-sm',
    sectionAction:
      'flex size-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition hover:bg-control hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    sectionActionIcon: 'size-4 stroke-current',
    list: 'w-full pb-6 flex flex-col',
    item: 'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-control-hover rounded-sm text-foreground hover:text-foreground cursor-pointer',
    activeItem: 'bg-control',
    iconWrap: 'size-8 rounded-sm flex shrink-0 justify-center items-center',
    icon: 'size-5 max-lg:size-5 stroke-current',
    label: 'text-base max-lg:text-inherit text-inherit',
    nestedList: 'min-h-0 space-y-1 py-1 pl-8',
    nestedItem:
      'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-control-hover rounded-sm text-foreground hover:text-foreground cursor-pointer',
    nestedActiveItem: 'bg-control',
    nestedIconWrap: 'flex size-7 shrink-0 items-center justify-center rounded-sm',
    nestedIcon: 'size-4 stroke-current',
    toggleButton:
      'mr-1 flex size-8 items-center justify-center rounded-sm text-foreground-muted transition hover:bg-control hover:text-foreground',
    dashboardSpacing: 'mb-4'
  }
} as const
