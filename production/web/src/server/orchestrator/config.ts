const defaultOrchestratorUrl = 'http://localhost:4100'

export const getOrchestratorBaseUrl = () => process.env.ORCHESTRATOR_API_URL || defaultOrchestratorUrl
