import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { parseBoundedRouteJson } from '@/server/http/route-input'
import { requireAutomationUser, validatePermittedWorkflowYaml } from '@/server/orchestrator/automations/action-helpers'

const validationInput = z.object({ yaml: z.string() }).strict()
const maximumRequestBytes = 4 * 1024 * 1024

export const POST = (request: Request) =>
  runRouteHandler(async () => {
    const user = await requireAutomationUser('automations:manage', 'api')
    const { yaml } = await parseBoundedRouteJson(request, validationInput, {
      maxBytes: maximumRequestBytes,
      tooLargeMessage: 'Workflow YAML is too large.',
      invalidMessage: 'Enter workflow YAML to validate.'
    })
    return validatePermittedWorkflowYaml(user, yaml)
  })
