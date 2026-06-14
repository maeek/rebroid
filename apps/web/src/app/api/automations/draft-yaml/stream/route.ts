import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { assertAutomationPermission, listPermittedAiTools } from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import type { DraftAutomationYamlInput } from '@/server/orchestrator/automations/types'

export const dynamic = 'force-dynamic'

export const POST = async (request: NextRequest) => {
  let user: Awaited<ReturnType<typeof getCurrentUserContext>>
  try {
    user = await getCurrentUserContext()
    assertAutomationPermission(user, 'automations:manage')
    assertAutomationPermission(user, 'automations:run-ai')
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Authentication required.' },
      { status: 403 }
    )
  }

  let input: DraftAutomationYamlInput
  try {
    input = (await request.json()) as DraftAutomationYamlInput
  } catch {
    return NextResponse.json({ message: 'Draft request body must be JSON.' }, { status: 400 })
  }

  if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
    return NextResponse.json({ message: 'Draft prompt is required.' }, { status: 400 })
  }

  const response = await orchestratorAutomationsClient.draftYamlStream(
    {
      ...input,
      allowedTools: await listPermittedAiTools(user)
    },
    request.signal
  )

  if (!response.body) {
    return NextResponse.json({ message: 'Draft stream did not return a response body.' }, { status: 502 })
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive'
    }
  })
}
