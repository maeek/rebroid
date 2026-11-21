import { z } from 'zod'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { assertAutomationPermission } from '@/server/orchestrator/automations/action-helpers'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { enforceStreamingLimit } from '@/server/upload-proxy/streaming-upload'

const validationInput = z.object({ yaml: z.string() }).strict()
const maximumRequestBytes = 4 * 1024 * 1024

export const POST = (request: Request) =>
  runRouteHandler(async () => {
    assertAutomationPermission(await getCurrentUserContext(), 'automations:manage')
    const body = request.body && enforceStreamingLimit(request.body, maximumRequestBytes, 'Workflow YAML is too large.')
    const payload: unknown = await new Response(body).json().catch((error: unknown) => {
      if (error instanceof PublicActionError) throw error
      throw new PublicActionError('Enter workflow YAML to validate.', { code: 'validation', status: 400 })
    })
    const input = validationInput.safeParse(payload)
    if (!input.success) {
      throw new PublicActionError('Enter workflow YAML to validate.', { code: 'validation', status: 400 })
    }
    return validateAutomationYamlAction(input.data.yaml)
  })
