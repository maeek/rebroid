'use client'

import { ChangeEvent } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { optimizeIconFile } from '@/shared/model/media/icon-metadata'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'

export const UserAvatarInput = ({
  name,
  avatar,
  disabled = false,
  onChange
}: {
  name: string
  avatar: string | null
  disabled?: boolean
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
        variant: 'danger'
      })
    }
  }

  return (
    <div className='flex flex-wrap items-center gap-4'>
      <Avatar className='size-16'>
        <AvatarImage src={avatar ?? ''} />
        <AvatarFallback
          className='text-base'
          style={{
            backgroundColor: getHslColorFromCharCode(name),
            color: getHslColorFromCharCodeForeground(name)
          }}
        >
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className='flex min-w-0 flex-1 flex-wrap gap-2'>
        <Button
          asChild
          type='button'
          variant='secondary'
          disabled={disabled}
        >
          <label>
            <IconUpload className='size-4' />
            Upload avatar
            <input
              className='hidden'
              type='file'
              accept='image/*'
              disabled={disabled}
              onChange={event => void handleFileChange(event)}
            />
          </label>
        </Button>
        <Button
          type='button'
          variant='ghost'
          disabled={disabled || !avatar}
          onClick={() => onChange(null)}
        >
          Clear avatar
        </Button>
      </div>
    </div>
  )
}
