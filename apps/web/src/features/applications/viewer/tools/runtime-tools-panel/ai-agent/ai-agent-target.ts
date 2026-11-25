import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type AiAgentTarget = Pick<AppDefinition, 'id' | 'name' | 'running'> &
  Partial<Pick<AppDefinition, 'profileMode' | 'profileName' | 'status' | 'lifecycleStage'>> & {
    attachmentId?: string
  }
