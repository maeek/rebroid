'use client'

import { ChangeEvent } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { optimizeIconFile } from '@/features/applications/icons/icon-metadata'
import { toast } from '@/hooks/use-toast'

export const UserAvatarInput = ({
  name,
  avatar,
  onChange
}: {
  name: string
  avatar: string | null
  onChange: (avatar: string | null) => void
}) => {
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      onChange(await optimizeIconFile(file))
    } catch (error) {
      toast({
        title: 'Could not prepare avatar',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className='flex items-center gap-4'>
      <Avatar className='size-16'>
        <AvatarImage src={avatar ?? ''} />
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className='flex flex-wrap gap-2'>
        <Button
          asChild
          type='button'
          variant='secondary'
        >
          <label>
            <IconUpload className='size-4' />
            Upload avatar
            <input
              className='hidden'
              type='file'
              accept='image/*'
              onChange={event => void handleFileChange(event)}
            />
          </label>
        </Button>
        <Button
          type='button'
          variant='ghost'
          disabled={!avatar}
          onClick={() => onChange(null)}
        >
          Clear avatar
        </Button>
      </div>
    </div>
  )
}
