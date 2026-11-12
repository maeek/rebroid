import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'

const safeId = (appId: string) => appId.replace(/[^a-zA-Z0-9_-]/g, '')
const configuredRootPath = () => process.env.WEB_APP_ICONS_PATH?.trim()
const storagePath = (fileName: string) => {
  const root = configuredRootPath()
  return root
    ? join(/*turbopackIgnore: true*/ root, fileName)
    : join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'app-icons', fileName)
}
const iconPath = (appId: string) => storagePath(`${safeId(appId)}.json`)
const iconFilePath = (appId: string, extension: string) => storagePath(`${safeId(appId)}.${extension}`)
const iconUrl = (appId: string) => `/api/app-icons/${encodeURIComponent(appId)}`

type StoredIconMetadata = {
  icon?: unknown
  fileName?: unknown
  mimeType?: unknown
}

const dataUrlPattern = /^data:([^;,]+);base64,([\s\S]+)$/
const maxIconBytes = 2 * 1024 * 1024
const maxCachedIconUrls = 512
const iconUrlCacheTtlMs = 30_000
const iconUrls = new Map<string, { appId: string; expiresAt: number; value: Promise<string | null> }>()

const extensionForMimeType = (mimeType: string) => {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

const parseIconDataUrl = (icon: string) => {
  const match = icon.match(dataUrlPattern)
  if (!match) {
    return null
  }

  const mimeType = match[1]
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
    return null
  }

  return {
    mimeType,
    extension: extensionForMimeType(mimeType),
    buffer: Buffer.from(match[2], 'base64')
  }
}

const readMetadata = async (appId: string): Promise<StoredIconMetadata | null> => {
  try {
    const content = await readFile(iconPath(appId), 'utf-8')
    return JSON.parse(content) as StoredIconMetadata
  } catch {
    return null
  }
}

const readStoredAppIconUrl = async (appId: string) => {
  const metadata = await readMetadata(appId)
  if (typeof metadata?.icon !== 'string') {
    return null
  }

  if (metadata.icon === iconUrl(appId)) {
    return metadata.icon
  }

  if (metadata.icon.startsWith('data:')) {
    return setStoredAppIcon(appId, metadata.icon)
  }

  return null
}

export const getStoredAppIcon = (appId: string) => {
  const path = iconPath(appId)
  const now = performance.now()
  const cached = iconUrls.get(path)
  if (cached?.appId === appId && cached.expiresAt > now) return cached.value

  const value = readStoredAppIconUrl(appId).catch((error: unknown) => {
    if (iconUrls.get(path)?.value === value) iconUrls.delete(path)
    throw error
  })
  iconUrls.delete(path)
  if (iconUrls.size >= maxCachedIconUrls) {
    const oldest = iconUrls.keys().next()
    if (!oldest.done) iconUrls.delete(oldest.value)
  }
  iconUrls.set(path, { appId, expiresAt: now + iconUrlCacheTtlMs, value })
  return value
}

export const setStoredAppIcon = async (appId: string, icon: string) => {
  const path = iconPath(appId)
  await mkdir(dirname(path), { recursive: true })
  const parsed = parseIconDataUrl(icon)

  if (!parsed) {
    throw new PublicActionError('App icons must be PNG, JPEG, or WebP image data.', {
      code: 'validation',
      status: 422
    })
  }
  if (parsed.buffer.length > maxIconBytes) {
    throw new PublicActionError('App icons must not exceed 2 MB.', { code: 'validation', status: 422 })
  }

  const fileName = `${safeId(appId)}.${parsed.extension}`
  const storedIcon = iconUrl(appId)
  try {
    await writeFile(iconFilePath(appId, parsed.extension), parsed.buffer, { mode: 0o600 })
    await writeFile(path, `${JSON.stringify({ icon: storedIcon, fileName, mimeType: parsed.mimeType }, null, 2)}\n`, {
      encoding: 'utf-8',
      mode: 0o600
    })
    return storedIcon
  } finally {
    iconUrls.delete(path)
  }
}

export const removeStoredAppIcon = async (appId: string) => {
  const metadataPath = iconPath(appId)
  const paths = [metadataPath, ...['png', 'jpg', 'webp'].map(extension => iconFilePath(appId, extension))]
  try {
    await Promise.all(
      paths.map(path =>
        unlink(path).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error
        })
      )
    )
  } finally {
    iconUrls.delete(metadataPath)
  }
}

export const cloneStoredAppIcon = async (sourceAppId: string, targetAppId: string) => {
  const source = await getStoredAppIconFile(sourceAppId)
  if (!source) {
    return null
  }

  const content = await readFile(source.path)
  return setStoredAppIcon(targetAppId, `data:${source.mimeType};base64,${content.toString('base64')}`)
}

export const getStoredAppIconFile = async (appId: string) => {
  const metadata = await readMetadata(appId)
  const fileName = typeof metadata?.fileName === 'string' ? metadata.fileName : null
  const mimeType = typeof metadata?.mimeType === 'string' ? metadata.mimeType : null
  if (!fileName || !mimeType) {
    return null
  }

  const extension = fileName.split('.').pop()
  if (!extension || !['png', 'jpg', 'webp'].includes(extension)) {
    return null
  }

  return {
    path: iconFilePath(appId, extension),
    mimeType
  }
}
