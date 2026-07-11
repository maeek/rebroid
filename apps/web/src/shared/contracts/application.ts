import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-client'

type AndroidApplication = OrchestratorApiSchemas['AndroidApplicationResponseDto']

export type ApplicationProfileMode = AndroidApplication['storage']['profileMode']
export type AndroidNotification = OrchestratorApiSchemas['AndroidNotificationDto']
export type ScrcpyTransport = AndroidApplication['runtime']['scrcpyTransport']
