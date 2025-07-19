import * as fs from 'fs/promises'
import * as path from 'path'
import { filterResolved } from '@/utils/promise-utils'
import { getAssignedTagForFile } from './tag-assignment'

const BASE_PATH = path.resolve('/Users/maek/Projects')

export interface FileOrFolder {
  index: number
  fullPath: string
  name: string
  type: 'folder' | 'file'
  ext: string
  size: number
  createdAt: string
  modifiedAt: string
  tags?: string[]
  color?: string
  preview?: {
    blurhash?: string
    url: string
  }
  shared?: boolean
}

const list = (requestedPath: string) => {
  const sanitizedPath = path.join(BASE_PATH, requestedPath.replace('..', ''))

  return fs.readdir(sanitizedPath, { withFileTypes: true }).then(async files => {
    const results = await Promise.allSettled(
      files.map(async (file, index) => {
        const stats = await fs.stat(path.resolve(sanitizedPath, file.name))
        const ext = path.extname(file.name)
        return {
          index,
          fullPath: path.resolve(sanitizedPath, file.name).substring(BASE_PATH.length),
          name: file.name,
          type: file.isDirectory() ? 'folder' : 'file',
          ext,
          size: file.isDirectory() ? (await fs.readdir(path.resolve(sanitizedPath, file.name))).length : stats.size,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
          tags: file.isDirectory() ? [] : getAssignedTagForFile(ext),
          color: undefined,
          preview: undefined
        } as FileOrFolder
      })
    )

    return filterResolved<FileOrFolder>(results)
  })
}

const createFolder = (name: string, requestedPath: string) => {
  const sanitizedPath = path.join(BASE_PATH, requestedPath.replace('..', ''))
  return fs.mkdir(path.resolve(sanitizedPath, name))
}

const removeSingle = async (toRemove: string) => {
  const sanitizedPath = path.join(BASE_PATH, toRemove.replace('..', ''))
  const isDirectory = await fs.stat(sanitizedPath).then(stats => stats.isDirectory())

  if (isDirectory) {
    return fs.rmdir(sanitizedPath, { recursive: true })
  }
  return fs.unlink(sanitizedPath)
}

const remove = async (toRemove: string[]) => {
  return Promise.allSettled(toRemove.map(removeSingle))
}

export const files = {
  list,
  createFolder,
  remove
}
