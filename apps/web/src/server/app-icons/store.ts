import { randomBytes } from 'node:crypto'
import { link, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import 'server-only'
import { KeyedSerialQueue } from '@/server/concurrency/keyed-serial-queue'
import { PublicActionError } from '@/server/errors/public-action-error'
import { logger } from '@/server/observability/logger'

const safeId = (appId: string) => appId.replace(/[^a-zA-Z0-9_-]/g, '')
const configuredRootPath = () => process.env.WEB_APP_ICONS_PATH?.trim()
const storagePath = (fileName: string) => {
  const root = configuredRootPath()
  return root
    ? join(/*turbopackIgnore: true*/ root, fileName)
    : join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'app-icons', fileName)
}
const iconPath = (appId: string) => storagePath(`${safeId(appId)}.json`)
const iconUrl = (appId: string, revision?: string) =>
  `/api/app-icons/${encodeURIComponent(appId)}${revision ? `?v=${revision}` : ''}`

type StoredIconMetadata = {
  icon?: unknown
  fileName?: unknown
  mimeType?: unknown
  revision?: unknown
}

const dataUrlPattern = /^data:([^;,]+);base64,([\s\S]+)$/
const maxIconBytes = 2 * 1024 * 1024
export const maxAppIconRequestBytes = Math.ceil(maxIconBytes / 3) * 4 + 1024
const iconWrites = new KeyedSerialQueue()
const revisionPattern = /^[a-f0-9]{32}$/

const getRevision = (metadata: StoredIconMetadata) =>
  typeof metadata.revision === 'string' && revisionPattern.test(metadata.revision) ? metadata.revision : undefined

const unlinkIfPresent = (path: string) =>
  unlink(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })

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

const publishedIconUrl = async (appId: string, metadata: StoredIconMetadata | null) => {
  if (!metadata || metadata.icon !== iconUrl(appId, getRevision(metadata))) return null
  const file = storedIconFile(appId, metadata)
  if (!file) return null
  const details = await stat(file.path).catch(() => null)
  return details?.isFile() && details.size > 0 ? metadata.icon : null
}

// Page reads and Server Actions can load separate module instances. Read the published metadata from disk.
export const getStoredAppIcon = async (appId: string) => {
  const metadata = await readMetadata(appId)
  if (typeof metadata?.icon !== 'string' || !metadata.icon.startsWith('data:')) return publishedIconUrl(appId, metadata)

  return iconWrites.run(iconPath(appId), async () => {
    const current = await readMetadata(appId)
    if (typeof current?.icon !== 'string' || !current.icon.startsWith('data:')) return publishedIconUrl(appId, current)
    return writeStoredAppIcon(appId, current.icon, current)
  })
}

const writeStoredAppIcon = async (
  appId: string,
  icon: string,
  previous: StoredIconMetadata | null,
  initialize: boolean = false
) => {
  const path = iconPath(appId)
  const parsed = typeof icon === 'string' ? parseIconDataUrl(icon) : null

  if (!parsed) {
    throw new PublicActionError('App icons must be PNG, JPEG, or WebP image data.', {
      code: 'validation',
      status: 422
    })
  }
  if (parsed.buffer.length > maxIconBytes) {
    throw new PublicActionError('App icons must not exceed 2 MB.', { code: 'validation', status: 422 })
  }

  const revision = randomBytes(16).toString('hex')
  const fileName = `${safeId(appId)}.${revision}.${parsed.extension}`
  const filePath = storagePath(fileName)
  const temporaryMetadata = `${path}.${revision}.tmp`
  const storedIcon = iconUrl(appId, revision)
  await mkdir(dirname(path), { recursive: true })
  try {
    await writeFile(filePath, parsed.buffer, { mode: 0o600 })
    await writeFile(
      temporaryMetadata,
      `${JSON.stringify({ icon: storedIcon, fileName, mimeType: parsed.mimeType, revision })}\n`,
      {
        encoding: 'utf-8',
        mode: 0o600
      }
    )
    if (initialize) {
      // A delayed Create app upload must never replace an icon set on the app page.
      await link(temporaryMetadata, path)
    } else {
      await rename(temporaryMetadata, path)
    }
  } catch (error) {
    await Promise.allSettled([unlinkIfPresent(filePath), unlinkIfPresent(temporaryMetadata)])
    if (initialize && (error as NodeJS.ErrnoException).code === 'EEXIST') return null
    throw error
  }
  if (initialize) {
    await unlinkIfPresent(temporaryMetadata).catch(() => logger.warn('application.icon_cleanup_failed', { appId }))
  }
  const previousFile = storedIconFile(appId, previous)
  if (previousFile) {
    await unlinkIfPresent(previousFile.path).catch(() => logger.warn('application.icon_cleanup_failed', { appId }))
  }
  return storedIcon
}

export const setStoredAppIcon = (appId: string, icon: string) =>
  iconWrites.run(iconPath(appId), async () => writeStoredAppIcon(appId, icon, await readMetadata(appId)))

export const setInitialStoredAppIcon = (appId: string, icon: string) =>
  iconWrites.run(iconPath(appId), () => writeStoredAppIcon(appId, icon, null, true))

export const removeStoredAppIcon = (appId: string) => {
  const path = iconPath(appId)
  return iconWrites.run(path, async () => {
    await unlinkIfPresent(path)
    const files = await readdir(dirname(path)).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    })
    const prefix = `${safeId(appId)}.`
    const iconFiles = files.filter(
      name =>
        name.startsWith(prefix) &&
        /^(?:(?:[a-f0-9]{32}\.)?(?:png|jpg|webp)|json\.[a-f0-9]{32}\.tmp)$/.test(name.slice(prefix.length))
    )
    await Promise.all(iconFiles.map(name => unlinkIfPresent(storagePath(name))))
  })
}

export const cloneStoredAppIcon = async (sourceAppId: string, targetAppId: string) => {
  const source = await getStoredAppIconFile(sourceAppId)
  if (!source) {
    return null
  }

  const content = await readFile(source.path)
  return setStoredAppIcon(targetAppId, `data:${source.mimeType};base64,${content.toString('base64')}`)
}

const storedIconFile = (appId: string, metadata: StoredIconMetadata | null) => {
  const fileName = typeof metadata?.fileName === 'string' ? metadata.fileName : null
  const mimeType = typeof metadata?.mimeType === 'string' ? metadata.mimeType : null
  if (!metadata || !fileName || !mimeType) {
    return null
  }

  const extension = fileName.split('.').pop()
  if (!extension || !['png', 'jpg', 'webp'].includes(extension)) {
    return null
  }

  const revision = getRevision(metadata)
  const expectedFileName = `${safeId(appId)}${revision ? `.${revision}` : ''}.${extension}`
  return fileName === expectedFileName ? { path: storagePath(fileName), mimeType } : null
}

export const getStoredAppIconFile = async (appId: string) => storedIconFile(appId, await readMetadata(appId))
