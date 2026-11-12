import { runRouteHandler } from '@/server/http/route-handler'
import { readAiProviderBillingIssues } from '@/server/orchestrator/settings/ai-provider-billing-query'

export const GET = async (request: Request) => {
  const response = await runRouteHandler(() => readAiProviderBillingIssues(request.signal))
  response.headers.set('cache-control', 'no-store')
  return response
}
