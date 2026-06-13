import type { ComponentType } from 'react'
import { IconAlertTriangle, IconLoader2, IconPlayerPlay } from '@tabler/icons-react'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type ViewerPlaceholder = {
  title: string
  description: string
  toneClassName: string
  Icon: ComponentType<{ className?: string }>
  showSpinner: boolean
  showProgress: boolean
}

type ViewerPlaceholderRule = {
  title: string
  description: string
  toneClassName: string
  Icon: ViewerPlaceholder['Icon']
  showSpinner?: boolean
  showProgress?: (app: AppDefinition) => boolean
}

const fallbackPlaceholder: ViewerPlaceholderRule = {
  title: 'Viewer unavailable',
  description: 'The live viewer is not available for this environment.',
  toneClassName: 'text-foreground-muted',
  Icon: IconAlertTriangle
}

const statusPlaceholders: Partial<Record<AppDefinition['status'], ViewerPlaceholderRule>> = {
  error: {
    title: 'App failed to start',
    description: 'Rebroid reported an error while preparing the viewer.',
    toneClassName: 'text-destructive',
    Icon: IconAlertTriangle
  },
  provisioning: {
    title: 'Preparing app',
    description: 'Preparing the Android environment and viewer connection.',
    toneClassName: 'text-primary',
    Icon: IconLoader2,
    showSpinner: true,
    showProgress: app => app.lifecycleStage === 'image_pulling'
  },
  removing: {
    title: 'Preparing app',
    description: 'Preparing the Android environment and viewer connection.',
    toneClassName: 'text-primary',
    Icon: IconLoader2,
    showSpinner: true,
    showProgress: app => app.lifecycleStage === 'image_pulling'
  },
  stopped: {
    title: 'App is stopped',
    description: 'Start the app to open the live viewer.',
    toneClassName: 'text-foreground-muted',
    Icon: IconPlayerPlay
  }
}

const unloadedPlaceholder: ViewerPlaceholder = {
  title: 'Viewer unavailable',
  description: 'App details are still loading.',
  toneClassName: 'text-foreground-muted',
  Icon: IconPlayerPlay,
  showSpinner: false,
  showProgress: false
}

const getPlaceholderTitle = (app: AppDefinition, rule: ViewerPlaceholderRule) => app.statusDetail?.title ?? rule.title

const getPlaceholderDescription = (app: AppDefinition, rule: ViewerPlaceholderRule) =>
  app.statusDetail?.description ?? app.statusMessage ?? rule.description

const getPlaceholderProgress = (app: AppDefinition, rule: ViewerPlaceholderRule) => rule.showProgress?.(app) ?? false

export const getViewerPlaceholder = (app?: AppDefinition): ViewerPlaceholder => {
  if (!app) {
    return unloadedPlaceholder
  }

  const rule = statusPlaceholders[app.status] ?? fallbackPlaceholder

  return {
    title: getPlaceholderTitle(app, rule),
    description: getPlaceholderDescription(app, rule),
    toneClassName: rule.toneClassName,
    Icon: rule.Icon,
    showSpinner: rule.showSpinner ?? false,
    showProgress: getPlaceholderProgress(app, rule)
  }
}
