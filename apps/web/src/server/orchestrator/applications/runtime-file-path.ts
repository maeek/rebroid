import { posix } from 'node:path'
import { PublicActionError } from '@/server/errors/public-action-error'

export function readRuntimeFilePath(request: Request, kind: 'directory' | 'file') {
  const value = new URL(request.url).searchParams.get('path')?.trim() ?? (kind === 'directory' ? '/data' : '')
  const path = posix.normalize(value).replace(/\/$/, '')
  if (
    value.length <= 4096 &&
    !value.includes('\0') &&
    (value === '/data' || value.startsWith('/data/')) &&
    (path.startsWith('/data/') || (kind === 'directory' && path === '/data'))
  )
    return path
  throw new PublicActionError(
    kind === 'directory' ? 'Choose a directory inside /data.' : 'Choose a file inside /data.',
    {
      code: 'validation',
      status: 400
    }
  )
}
