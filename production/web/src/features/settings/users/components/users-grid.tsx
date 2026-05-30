'use client'

import { IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import type { PublicUser, UserGroup } from '@/server/auth/user'

export const UsersGrid = ({
  users,
  groups,
  busyUserId,
  onToggleDisabled,
  onDelete
}: {
  users: PublicUser[]
  groups: UserGroup[]
  busyUserId: string | null
  onToggleDisabled: (user: PublicUser) => void
  onDelete: (user: PublicUser) => void
}) => {
  return (
    <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
      <div className='overflow-x-auto'>
        <Table
          className='table-fixed'
          style={{ minWidth: '64rem' }}
        >
          <TableHeader className='bg-background/45'>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='w-[20rem] px-4 py-3 uppercase'>User</TableHead>
              <TableHead className='w-36 px-4 py-3 uppercase'>Role</TableHead>
              <TableHead className='w-56 px-4 py-3 uppercase'>Group</TableHead>
              <TableHead className='w-32 px-4 py-3 uppercase'>Status</TableHead>
              <TableHead className='w-52 px-4 py-3 text-right uppercase'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell className='px-4 py-3'>
                  <Link href={`/settings/users/${user.id}`}>
                    <div className='flex min-w-0 items-center gap-3'>
                      <Avatar className='size-9'>
                        <AvatarImage src={user.avatarDataUrl ?? ''} />
                        <AvatarFallback
                          style={{
                            backgroundColor: getHslColorFromCharCode(user.name),
                            color: getHslColorFromCharCodeForeground(user.name)
                          }}
                        >
                          {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className='min-w-0'>
                        <div className='truncate font-medium hover:underline cursor-pointer focus:underline hover:text-primary'>
                          {user.name}
                        </div>
                        <div className='truncate text-xs text-muted-foreground'>{user.username}</div>
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className='px-4 py-3 capitalize text-secondary-foreground'>{user.role}</TableCell>
                <TableCell className='px-4 py-3 text-secondary-foreground'>
                  <div className='flex flex-wrap gap-1.5'>
                    {user.groupIds.map(groupId => (
                      <Link
                        href={`/settings/groups/${groupId}`}
                        key={groupId}
                      >
                        <Badge
                          variant='secondary'
                          className='max-w-full truncate'
                        >
                          {groups.find(group => group.id === groupId)?.name ?? groupId}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </TableCell>
                <TableCell className={user.disabled ? 'px-4 py-3 text-destructive' : 'px-4 py-3 text-primary'}>
                  {/* {user.disabled ? 'Disabled' : 'Active'} */}
                  <Button
                    type='button'
                    variant='link'
                    disabled={busyUserId === user.id}
                    onClick={() => onToggleDisabled(user)}
                  >
                    {user.disabled ? 'Disabled' : 'Active'}
                  </Button>
                </TableCell>
                <TableCell className='px-4 py-3'>
                  <div className='flex justify-end gap-2'>
                    <Button
                      type='button'
                      variant='ghost'
                      disabled={busyUserId === user.id}
                      onClick={() => onDelete(user)}
                    >
                      <IconTrash className='size-4' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
