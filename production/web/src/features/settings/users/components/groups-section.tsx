'use client'

import { useState } from 'react'
import { IconEdit, IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { createUserGroupAction } from '@/server/users/actions/create-user-group-action'
import type { UserGroup } from '@/server/auth/user'

export const GroupsSection = ({
  groups,
  onGroupUpdated
}: {
  groups: UserGroup[]
  onGroupUpdated: (group: UserGroup) => void
}) => {
  const [newGroupName, setNewGroupName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const createGroup = async () => {
    setIsSaving(true)
    try {
      const group = await createUserGroupAction({ name: newGroupName })
      onGroupUpdated(group)
      setNewGroupName('')
      toast({ title: 'Group created' })
    } catch (error) {
      toast({
        title: 'Could not create group',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Section
        title='Groups'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-3'
      >
        <p className='text-sm text-secondary-foreground'>
          Groups provide default permissions and quotas. User-level settings can override them when needed.
        </p>
        <div className='flex flex-wrap gap-2'>
          <Input
            value={newGroupName}
            className='max-w-sm'
            placeholder='New Group Name'
            onChange={event => setNewGroupName(event.target.value)}
          />
          <Button
            type='button'
            variant='secondary'
            disabled={isSaving || !newGroupName.trim()}
            onClick={() => void createGroup()}
          >
            <IconPlus className='size-4' />
            Create Group
          </Button>
        </div>
        <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
          <Table>
            <TableHeader className='bg-background/45'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='px-4 py-3 uppercase'>Group</TableHead>
                <TableHead className='w-32 px-4 py-3 uppercase'>Role</TableHead>
                <TableHead className='w-32 px-4 py-3 text-right uppercase'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map(group => (
                <TableRow key={group.id}>
                  <TableCell className='px-4 py-3'>
                    <div className='font-medium'>{group.name}</div>
                    <div className='text-xs text-muted-foreground'>{group.description}</div>
                  </TableCell>
                  <TableCell className='px-4 py-3 capitalize text-secondary-foreground'>{group.role}</TableCell>
                  <TableCell className='px-4 py-3 text-right'>
                    <Button
                      type='button'
                      variant='secondary'
                      asChild
                    >
                      <Link href={`/settings/users/groups/${group.id}`}>
                        <IconEdit className='size-4' />
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
    </>
  )
}
