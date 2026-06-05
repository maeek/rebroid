import { redirect } from 'next/navigation'

export default async function OrchestratorAiProviderRedirectPage({
  params
}: {
  params: Promise<{ providerId: string }>
}) {
  const { providerId } = await params

  redirect(`/orchestrator/ai-providers/${encodeURIComponent(providerId)}`)
}
