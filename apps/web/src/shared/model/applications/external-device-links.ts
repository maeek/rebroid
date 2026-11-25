import type { ExternalDevice } from '@/shared/contracts/external-device'

export const externalDeviceViews = {
  overview: 'Overview',
  connection: 'Connection',
  activity: 'Activity',
  diagnostics: 'Diagnostics',
  workflows: 'Workflows',
  'ai-agent': 'AI agent'
} as const

export type ExternalDeviceView = keyof typeof externalDeviceViews

export const externalDeviceHref = (id: string, view: ExternalDeviceView = 'overview') => {
  const base = `/devices/external/${encodeURIComponent(id)}`
  return view === 'overview' ? base : `${base}?view=${view}`
}

export const externalDeviceStatusLabel: Record<ExternalDevice['connection']['state'], string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  awaiting_android_approval: 'Awaiting Android approval',
  awaiting_usb_replug: 'Awaiting USB reconnection',
  awaiting_verification: 'Awaiting verification',
  ready: 'Verified and connected',
  offline: 'Offline'
}

export const externalDeviceViewerHref = (id: string, attachmentId: string) =>
  `/viewer/devices/external/${encodeURIComponent(id)}?${new URLSearchParams({ attachment: attachmentId })}`
