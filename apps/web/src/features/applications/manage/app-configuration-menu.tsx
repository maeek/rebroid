import type { ReactNode } from 'react'
import { IconDatabase, IconDotsVertical } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export const AppConfigurationMenu = ({ profilesHref, children }: { profilesHref?: string; children?: ReactNode }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type='button'
        variant='ghost'
        size='icon-md'
        aria-label='More configuration actions'
        disabled={!profilesHref}
      >
        <IconDotsVertical className='size-4' />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align='end'>
      {profilesHref ? (
        <DropdownMenuItem asChild>
          <Link href={profilesHref}>
            <IconDatabase className='size-4' />
            Profiles
          </Link>
        </DropdownMenuItem>
      ) : null}
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
)
