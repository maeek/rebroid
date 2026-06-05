import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import 'server-only'

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

export const getStoredAppIcon = async (appId: string) => {
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

export const setStoredAppIcon = async (appId: string, icon: string) => {
  const path = iconPath(appId)
  await mkdir(dirname(path), { recursive: true })
  const parsed = parseIconDataUrl(icon)

  if (!parsed) {
    throw new Error('App icons must be PNG, JPEG, or WebP image data.')
  }
  if (parsed.buffer.length > maxIconBytes) {
    throw new Error('App icons must not exceed 2 MB.')
  }

  const fileName = `${safeId(appId)}.${parsed.extension}`
  await writeFile(iconFilePath(appId, parsed.extension), parsed.buffer, { mode: 0o600 })
  const storedIcon = iconUrl(appId)
  await writeFile(path, `${JSON.stringify({ icon: storedIcon, fileName, mimeType: parsed.mimeType }, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600
  })
  return storedIcon
}

export const removeStoredAppIcon = async (appId: string) => {
  await Promise.all([
    unlink(iconPath(appId)).catch(() => undefined),
    unlink(iconFilePath(appId, 'png')).catch(() => undefined),
    unlink(iconFilePath(appId, 'jpg')).catch(() => undefined),
    unlink(iconFilePath(appId, 'webp')).catch(() => undefined)
  ])
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
