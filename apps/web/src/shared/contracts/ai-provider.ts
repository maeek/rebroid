import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type AutomationAiModelCatalogProvider = OrchestratorApiSchemas['AutomationAiModelCatalogProviderDto']
export type AutomationAiProviderHealth = OrchestratorApiSchemas['AutomationAiProviderHealthDto']
export type AutomationAiProvider = OrchestratorApiSchemas['AutomationAiProviderResponseDto']
export type AutomationAiProviderModel = OrchestratorApiSchemas['AutomationAiProviderModelDto']
export type AutomationAiProviderModelDownload = OrchestratorApiSchemas['AutomationAiProviderModelDownloadDto']
export type AutomationAiProviderRemoteModel = OrchestratorApiSchemas['AutomationAiProviderRemoteModelDto']
export type OpenAiBillingIssue = OrchestratorApiSchemas['OpenAiBillingIssueDto']

export interface AiProviderBillingIssueEntry {
  providerId: string
  issue: OpenAiBillingIssue
}
