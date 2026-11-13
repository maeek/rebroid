import { getRequiredServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { loadServiceContainers } from '@/server/orchestrator/platform/service-containers'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export const loadOcrPageData = async (health: OrchestratorHealth) => {
  const { services } = await getRequiredServerOrchestratorUiSettings()
  const containers = await loadServiceContainers(health, { settings: { ocr: services.ocr } })

  return {
    initialHealth: health.services.ocr,
    initialSettings: services.ocr,
    container: containers.ocr
  }
}
