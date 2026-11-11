import { randomUUID } from 'node:crypto'
import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { administratorsGroupId, isBuiltInGroup } from '@/shared/permissions/effective-access'
import { defaultUserPermissions } from '@/shared/permissions/permissions'
import { nowIso, validateGroupPolicy } from './user-model'
import { mutateUsersFile, type PrepareViewerRevocation } from './user-store'
import type { UsersFile } from './user-model'
import type { UserGroup } from '@/shared/contracts/auth-user'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

const prepareGroupRevocation = (id: string, prepareRevocation?: PrepareViewerRevocation) =>
  prepareRevocation &&
  ((file: UsersFile) => prepareRevocation(file.users.filter(user => user.groupIds.includes(id)).map(user => user.id)))

const updateGroup = async (
  id: string,
  input: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'updatedAt' | 'quotas'>> & {
    quotas?: Partial<ResourceQuota>
  },
  prepareRevocation?: PrepareViewerRevocation
) =>
  mutateUsersFile(
    file => {
      const group = file.groups.find(item => item.id === id)
      if (!group) throw new PublicActionError('Group not found.', { code: 'not_found', status: 404 })
      if (input.name !== undefined) group.name = input.name.trim() || group.name
      if (input.description !== undefined) group.description = input.description.trim()
      if (id !== administratorsGroupId) {
        Object.assign(group, validateGroupPolicy(input.permissions ?? group.permissions, input.quotas ?? group.quotas))
      }
      group.updatedAt = nowIso()
      return group
    },
    prepareGroupRevocation(id, prepareRevocation)
  )

const deleteGroup = async (id: string, prepareRevocation?: PrepareViewerRevocation) => {
  if (isBuiltInGroup(id)) {
    throw new PublicActionError('Built-in groups cannot be deleted.', { code: 'conflict', status: 409 })
  }
  return mutateUsersFile(
    file => {
      const group = file.groups.find(item => item.id === id)
      if (!group) throw new PublicActionError('Group not found.', { code: 'not_found', status: 404 })
      file.groups = file.groups.filter(item => item.id !== id)
      for (const user of file.users) {
        if (!user.groupIds.includes(id)) continue
        user.groupIds = user.groupIds.filter(groupId => groupId !== id)
        user.updatedAt = nowIso()
      }
      return group
    },
    prepareGroupRevocation(id, prepareRevocation)
  )
}

const createGroup = async (input: {
  name: string
  description?: string
  permissions?: PermissionMap
  quotas?: Partial<ResourceQuota>
}) =>
  mutateUsersFile(file => {
    const name = input.name.trim()
    if (!name) throw new PublicActionError('Group name is required.', { code: 'validation', status: 422 })
    const now = nowIso()
    const group: UserGroup = {
      id: randomUUID(),
      name,
      description: input.description?.trim() ?? '',
      ...validateGroupPolicy(input.permissions ?? defaultUserPermissions, input.quotas ?? {}),
      createdAt: now,
      updatedAt: now
    }
    file.groups.push(group)
    return group
  })

export const userGroupService = { createGroup, deleteGroup, updateGroup }
