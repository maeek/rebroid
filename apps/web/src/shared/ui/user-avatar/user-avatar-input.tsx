'use client'

import { useState, type ChangeEvent } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { FormField } from '@/components/ui/form-field'
import { optimizeIconFile } from '@/shared/model/media/icon-metadata'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'

export const UserAvatarInput = ({
  name,
  avatar,
  disabled = false,
  onChange,
  onPendingChange
}: {
  name: string
  avatar: string | null
  disabled?: boolean
  onChange: (avatar: string | null) => void
  onPendingChange?: (pending: boolean) => void
}) => {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [selection, setSelection] = useState<{ filename: string; avatar: string }>()
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(undefined)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a PNG, JPEG, or WebP image up to 5 MB.')
      return
    }
    setPending(true)
    onPendingChange?.(true)
    try {
      const prepared = await optimizeIconFile(file)
      onChange(prepared)
      setSelection({ filename: file.name, avatar: prepared })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare the photo. Try another image.')
    } finally {
      setPending(false)
      onPendingChange?.(false)
    }
  }

  return (
    <FormField
      label='Profile photo'
      layout='vertical'
      description='PNG, JPEG, or WebP, up to 5 MB. Cropped to a square. Changes apply when you save.'
      error={error}
    >
      <AvatarUploadControl
        name={name}
        avatar={avatar}
        disabled={disabled}
        pending={pending}
        filename={selection?.avatar === avatar ? selection.filename : undefined}
        onFileChange={event => void handleFileChange(event)}
        onRemove={() => {
          onChange(null)
          setSelection(undefined)
          setError(undefined)
        }}
      />
    </FormField>
  )
}

const AvatarUploadControl = ({
  name,
  avatar,
  disabled,
  pending,
  filename,
  onFileChange,
  onRemove,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid
}: {
  name: string
  avatar: string | null
  disabled: boolean
  pending: boolean
  filename?: string
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}) => (
  <div className='flex w-full min-w-0 items-center gap-4'>
    <Avatar className='size-16 shrink-0'>
      <AvatarImage
        src={avatar ?? ''}
        alt={`${name || 'User'} profile photo`}
      />
      <AvatarFallback
        className='text-base'
        style={{ backgroundColor: getHslColorFromCharCode(name), color: getHslColorFromCharCodeForeground(name) }}
      >
        {name.slice(0, 2).toUpperCase() || '?'}
      </AvatarFallback>
    </Avatar>
    <div className='grid min-w-0 gap-2'>
      <FileUploadField
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        accept='image/png,image/jpeg,image/webp'
        buttonLabel={avatar ? 'Change photo' : 'Choose photo'}
        pendingLabel='Preparing…'
        pending={pending}
        disabled={disabled}
        filenameLabel={pending ? 'Preparing photo…' : (filename ?? (avatar ? 'Current photo' : 'Using initials'))}
        emptyLabel={avatar ? 'Current photo' : 'Using initials'}
        onChange={onFileChange}
      />
      {avatar ? (
        <Button
          type='button'
          className='justify-self-start'
          variant='ghost'
          size='sm'
          disabled={disabled || pending}
          onClick={onRemove}
        >
          Remove photo
        </Button>
      ) : null}
    </div>
  </div>
)
