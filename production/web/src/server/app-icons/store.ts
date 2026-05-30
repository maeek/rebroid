import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const safeId = (appId: string) => appId.replace(/[^a-zA-Z0-9_-]/g, '')
const rootPath = () => process.env.WEB_APP_ICONS_PATH || join(process.cwd(), 'data', 'app-icons')
const iconPath = (appId: string) => join(rootPath(), `${safeId(appId)}.json`)
const iconFilePath = (appId: string, extension: string) => join(rootPath(), `${safeId(appId)}.${extension}`)
const iconUrl = (appId: string) => `/api/app-icons/${encodeURIComponent(appId)}`

type StoredIconMetadata = {
  icon?: unknown
  fileName?: unknown
  mimeType?: unknown
}

const dataUrlPattern = /^data:([^;,]+);base64,([\s\S]+)$/

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

  if (!metadata.icon.startsWith('data:')) {
    return metadata.icon
  }

  return setStoredAppIcon(appId, metadata.icon)
}

export const setStoredAppIcon = async (appId: string, icon: string) => {
  const path = iconPath(appId)
  await mkdir(dirname(path), { recursive: true })
  const parsed = parseIconDataUrl(icon)

  if (!parsed) {
    await writeFile(path, `${JSON.stringify({ icon }, null, 2)}\n`, 'utf-8')
    return icon
  }

  const fileName = `${safeId(appId)}.${parsed.extension}`
  await writeFile(iconFilePath(appId, parsed.extension), parsed.buffer)
  const storedIcon = iconUrl(appId)
  await writeFile(
    path,
    `${JSON.stringify({ icon: storedIcon, fileName, mimeType: parsed.mimeType }, null, 2)}\n`,
    'utf-8'
  )
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
