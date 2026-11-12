import type { AndroidApplicationLifecycleStage, AndroidApplicationStatus } from '@/shared/contracts/application'

const appGalleryStatuses = ['all', 'running', 'stopped', 'error', 'working'] as const

export type AppsGalleryStatus = (typeof appGalleryStatuses)[number]

export const appGalleryStatusParam = 'status'
export const appsNeedingAttentionHref = `/apps?${appGalleryStatusParam}=error`
export const appsInProgressHref = `/apps?${appGalleryStatusParam}=working`

export const parseAppGalleryStatus = (value: string | null | undefined): AppsGalleryStatus =>
  appGalleryStatuses.find(status => status === value) ?? 'all'

export const isAppInProgress = (status: AndroidApplicationStatus, stage: AndroidApplicationLifecycleStage) =>
  status === 'provisioning' || status === 'removing' || stage === 'stopping'
