'use client'

import type { ComponentProps } from 'react'
import { IconArrowRight, IconShieldCheck } from '@tabler/icons-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Section } from '@/components/ui/section'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import type { ShellUser } from '../shell-user'

export const ProfileDialog = ({
  open,
  user,
  onOpenChange,
  finalFocus
}: {
  open: boolean
  user: ShellUser
  onOpenChange: (open: boolean) => void
  finalFocus: ComponentProps<typeof DialogContent>['finalFocus']
}) => (
  <Dialog
    modal
    open={open}
    onOpenChange={onOpenChange}
  >
    <DialogContent
      className='gap-5 p-4 sm:max-w-3xl sm:p-6'
      finalFocus={finalFocus}
    >
      <DialogHeader className='pr-8'>
        <DialogTitle className='text-xl leading-snug'>Account overview</DialogTitle>
        <DialogDescription>Your Rebroid profile and sign-in security.</DialogDescription>
      </DialogHeader>
      <div className='grid gap-3 sm:grid-cols-2'>
        <Section
          surface='panel'
          title='Profile'
          contentClassName='grow gap-4'
        >
          <div className='flex min-w-0 items-center gap-3'>
            <Avatar className='size-14 shrink-0'>
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
            <div className='min-w-0 [overflow-wrap:anywhere]'>
              <p className='font-medium'>{user.name}</p>
              <p className='text-sm text-foreground-muted'>{user.username}</p>
            </div>
          </div>
          {user.isPlatformAdmin ? (
            <Badge
              className='w-fit'
              variant='neutral'
            >
              Administrator
            </Badge>
          ) : null}
          <Button
            variant='ghost'
            asChild
            className='mt-auto self-start'
          >
            <Link
              href='/preferences/general#profile'
              onClick={() => onOpenChange(false)}
            >
              Edit profile photo <IconArrowRight className='size-4' />
            </Link>
          </Button>
        </Section>
        <Section
          surface='panel'
          title='Sign-in security'
          contentClassName='grow gap-4'
        >
          <div className='flex items-start gap-3'>
            <IconShieldCheck
              aria-hidden
              className='mt-0.5 size-5 shrink-0 text-foreground-muted'
            />
            <div className='grid gap-1'>
              <p className='text-sm font-medium'>Multi-factor authentication</p>
              <p className='text-sm text-foreground-muted'>{user.mfaEnabled ? 'Enabled' : 'Off'}</p>
            </div>
          </div>
          <Button
            variant='ghost'
            asChild
            className='mt-auto self-start'
          >
            <Link
              href='/preferences/general#security'
              onClick={() => onOpenChange(false)}
            >
              Manage sign-in <IconArrowRight className='size-4' />
            </Link>
          </Button>
        </Section>
      </div>
    </DialogContent>
  </Dialog>
)
