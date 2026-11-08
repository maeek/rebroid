import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'

export const loadPlatformFeatures = () => orchestratorSettingsClient.getFeatures()
