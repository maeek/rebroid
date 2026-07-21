import { randomUUID } from 'node:crypto'
import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { defaultUserPermissions, fullPermissions, mergeQuotas, unlimitedQuota } from '@/shared/permissions/permissions'
import { nowIso } from './user-model'
import { mutateUsersFile } from './user-store'
import type { UserGroup, UserRole } from '@/shared/contracts/auth-user'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

const updateGroup = async (
  id: string,
  input: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'updatedAt' | 'quotas'>> & {
    quotas?: Partial<ResourceQuota>
  }
) =>
  mutateUsersFile(file => {
    const group = file.groups.find(item => item.id === id)
    if (!group) throw new PublicActionError('Group not found.', { code: 'not_found', status: 404 })
    if (input.name !== undefined) group.name = input.name.trim() || group.name
    if (input.description !== undefined) group.description = input.description.trim()
    if (input.role !== undefined) group.role = input.role
    if (input.permissions !== undefined)
      group.permissions = group.role === 'admin' ? fullPermissions : input.permissions
    if (input.quotas !== undefined) group.quotas = group.role === 'admin' ? unlimitedQuota : mergeQuotas(input.quotas)
    group.updatedAt = nowIso()
    return group
  })

const deleteGroup = async (id: string) =>
  mutateUsersFile(file => {
    const group = file.groups.find(item => item.id === id)
    if (!group) throw new PublicActionError('Group not found.', { code: 'not_found', status: 404 })
    if (file.groups.length < 2) {
      throw new PublicActionError('Cannot remove the last user group.', { code: 'conflict', status: 409 })
    }
    file.groups = file.groups.filter(item => item.id !== id)
    for (const user of file.users) {
      user.groupIds = user.groupIds.filter(groupId => groupId !== id)
      user.updatedAt = nowIso()
    }
    return group
  })

const createGroup = async (input: {
  name: string
  description?: string
  role?: UserRole
  permissions?: PermissionMap
  quotas?: Partial<ResourceQuota>
}) =>
  mutateUsersFile(file => {
    const name = input.name.trim()
    if (!name) throw new PublicActionError('Group name is required.', { code: 'validation', status: 422 })
    const role = input.role ?? 'user'
    const now = nowIso()
    const group: UserGroup = {
      id: randomUUID(),
      name,
      description: input.description?.trim() ?? '',
      role,
      permissions: role === 'admin' ? fullPermissions : (input.permissions ?? defaultUserPermissions),
      quotas: role === 'admin' ? unlimitedQuota : mergeQuotas(input.quotas),
      createdAt: now,
      updatedAt: now
    }
    file.groups.push(group)
    return group
  })

export const userGroupService = { createGroup, deleteGroup, updateGroup }
