'use client'

import { IconEdit, IconPower, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PublicUser, UserGroup } from '@/server/auth/user'

const groupNames = (groups: UserGroup[], groupIds: string[]) =>
  groupIds.map(groupId => groups.find(group => group.id === groupId)?.name ?? groupId)

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
                  <div className='flex min-w-0 items-center gap-3'>
                    <Avatar className='size-9'>
                      <AvatarImage src={user.avatarDataUrl ?? ''} />
                      <AvatarFallback>{user.name.slice(0, 2).toLocaleUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className='min-w-0'>
                      <div className='truncate font-medium'>{user.name}</div>
                      <div className='truncate text-xs text-muted-foreground'>{user.username}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className='px-4 py-3 capitalize text-secondary-foreground'>{user.role}</TableCell>
                <TableCell className='px-4 py-3 text-secondary-foreground'>
                  <div className='flex flex-wrap gap-1.5'>
                    {groupNames(groups, user.groupIds).map(groupName => (
                      <Badge
                        key={groupName}
                        variant='secondary'
                        className='max-w-full truncate'
                      >
                        {groupName}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className={user.disabled ? 'px-4 py-3 text-destructive' : 'px-4 py-3 text-primary'}>
                  {user.disabled ? 'Disabled' : 'Active'}
                </TableCell>
                <TableCell className='px-4 py-3'>
                  <div className='flex justify-end gap-2'>
                    <Link href={`/settings/users/${user.id}`}>
                      <Button
                        type='button'
                        variant='secondary'
                        disabled={busyUserId === user.id}
                      >
                        <IconEdit className='size-4' />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      type='button'
                      variant='secondary'
                      disabled={busyUserId === user.id}
                      onClick={() => onToggleDisabled(user)}
                    >
                      <IconPower className='size-4' />
                      {user.disabled ? 'Enable' : 'Disable'}
                    </Button>
                    <Button
                      type='button'
                      variant='destructive'
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
