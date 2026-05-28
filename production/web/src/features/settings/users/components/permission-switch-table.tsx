'use client'

import { useMemo, useState } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import {
  permissionCategories,
  permissionDefinitions,
  type PermissionId,
  type PermissionMap
} from '@/shared/permissions/permissions'

type PermissionDefinition = (typeof permissionDefinitions)[number]
export type PermissionInheritanceMap = Partial<Record<PermissionId, string[]>>

const permissionMatchesSearch = (
  permission: PermissionDefinition,
  categoryName: string,
  inheritedFrom: string[],
  query: string
) => {
  const haystack =
    `${permission.name} ${permission.description} ${permission.id} ${categoryName} ${inheritedFrom.join(' ')}`.toLowerCase()
  return haystack.includes(query)
}

export const PermissionSwitchTable = ({
  permissions,
  onChange,
  inheritedPermissions = {},
  className
}: {
  permissions: PermissionMap
  onChange: (permissions: PermissionMap) => void
  inheritedPermissions?: PermissionInheritanceMap
  className?: string
}) => {
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLowerCase()

  const permissionGroups = useMemo(
    () =>
      permissionCategories
        .map(category => {
          const allPermissions = permissionDefinitions.filter(permission => permission.category === category.id)
          const visiblePermissions = normalizedSearch
            ? allPermissions.filter(permission =>
                permissionMatchesSearch(
                  permission,
                  category.name,
                  inheritedPermissions[permission.id] ?? [],
                  normalizedSearch
                )
              )
            : allPermissions

          return {
            category,
            allPermissions,
            visiblePermissions
          }
        })
        .filter(group => group.visiblePermissions.length > 0),
    [inheritedPermissions, normalizedSearch]
  )

  const getInheritedFrom = (id: PermissionId) => inheritedPermissions[id] ?? []

  const getPermissionEnabled = (id: PermissionId) => permissions[id] ?? getInheritedFrom(id).length > 0

  const setPermission = (id: PermissionId, enabled: boolean) => {
    onChange({ ...permissions, [id]: enabled })
  }

  const setCategoryPermissions = (categoryPermissions: readonly PermissionDefinition[], enabled: boolean) => {
    const nextPermissions = { ...permissions }
    for (const permission of categoryPermissions) {
      nextPermissions[permission.id] = enabled
    }
    onChange(nextPermissions)
  }

  const getEnabledCount = (categoryPermissions: readonly PermissionDefinition[]) =>
    categoryPermissions.filter(permission => getPermissionEnabled(permission.id)).length

  return (
    <div className={cn('overflow-hidden', className)}>
      <div className='pb-3'>
        <div className='relative'>
          <IconSearch className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            className='pl-9'
            placeholder='Search permissions'
            onChange={event => setSearch(event.target.value)}
          />
        </div>
      </div>
      <ScrollArea>
        <Visible when={permissionGroups.length > 0}>
          <div>
            {permissionGroups.map(group => {
              const enabledCount = getEnabledCount(group.allPermissions)
              const allEnabled = enabledCount === group.allPermissions.length

              return (
                <section key={group.category.id}>
                  <div className='flex items-center justify-between gap-4 border-y border-border/60 py-3'>
                    <div className='min-w-0'>
                      <h4 className='text-sm font-semibold'>{group.category.name}</h4>
                      <p className='text-xs text-muted-foreground'>
                        {enabledCount}/{group.allPermissions.length} enabled
                      </p>
                    </div>
                    <Switch
                      checked={allEnabled}
                      aria-label={`Toggle ${group.category.name} permissions`}
                      onCheckedChange={checked => setCategoryPermissions(group.allPermissions, checked)}
                    />
                  </div>
                  <div className='divide-y divide-border/45'>
                    {group.visiblePermissions.map(permission => {
                      const inheritedFrom = getInheritedFrom(permission.id)
                      const isOverridden = permissions[permission.id] !== undefined

                      return (
                        <div
                          key={permission.id}
                          className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 pl-2'
                        >
                          <div className='min-w-0 pl-4'>
                            <div className='flex flex-wrap items-center gap-2'>
                              <div className='font-normal text'>{permission.name}</div>
                              {inheritedFrom.map(groupName => (
                                <Badge
                                  key={groupName}
                                  variant='status'
                                  className='border-primary/25 bg-primary/10 text-[0.65rem] text-primary'
                                >
                                  {groupName}
                                </Badge>
                              ))}
                              <Visible when={isOverridden}>
                                <Badge
                                  variant='secondary'
                                  className='text-[0.65rem]'
                                >
                                  override
                                </Badge>
                              </Visible>
                            </div>
                            <div className='text-xs text-muted-foreground'>{permission.description}</div>
                          </div>
                          <Switch
                            checked={getPermissionEnabled(permission.id)}
                            aria-label={`Toggle ${permission.name}`}
                            onCheckedChange={checked => setPermission(permission.id, checked)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </Visible>
        <Visible when={permissionGroups.length === 0}>
          <div className='flex min-h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground'>
            No permissions match your search.
          </div>
        </Visible>
      </ScrollArea>
    </div>
  )
}
