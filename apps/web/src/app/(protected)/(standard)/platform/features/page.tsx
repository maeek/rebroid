import { FeaturesPage } from '@/features/platform/features/features-page'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'

export default async function PlatformFeaturesPage() {
  return <FeaturesPage initialManifest={await orchestratorSettingsClient.getFeatures()} />
}
