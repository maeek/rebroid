import 'server-only'
import { z } from 'zod'
import { PublicActionError } from '@/server/errors/public-action-error'
import { enforceStreamingLimit } from '@/server/upload-proxy/streaming-upload'

export const routeResourceId = z.string().trim().min(1).max(128)

export function parseRouteInput<T>(schema: z.ZodType<T>, value: unknown, message = 'Invalid request parameters.'): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new PublicActionError(message, { code: 'validation', status: 400 })
  return parsed.data
}

export async function readRouteJson(
  request: Pick<Request, 'json'>,
  message = 'Invalid JSON request body.'
): Promise<unknown> {
  try {
    return await request.json()
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    throw new PublicActionError(message, { code: 'validation', status: 400 })
  }
}

export async function parseBoundedRouteJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  options: { maxBytes: number; tooLargeMessage: string; invalidMessage: string }
) {
  const body = request.body && enforceStreamingLimit(request.body, options.maxBytes, options.tooLargeMessage)
  const input = await readRouteJson(new Response(body), options.invalidMessage)
  return parseRouteInput(schema, input, options.invalidMessage)
}
