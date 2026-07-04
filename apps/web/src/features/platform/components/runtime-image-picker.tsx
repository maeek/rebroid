import { useId, useMemo } from 'react'
import { IconBox, IconSearch } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { imageDisplayName } from '@/features/platform/domain/image-display-name'
import { findPlatformImageByReference } from '@/features/platform/domain/runtime-image-metadata'
import { cn } from '@/lib/utils'
import { RuntimeImageBadges } from './runtime-image-badges'
import type { PlatformImage } from '@/server/orchestrator/platform/types'

type RuntimeImagePickerProps = {
  images: PlatformImage[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

const imageSearchText = (image: PlatformImage) =>
  [imageDisplayName(image), image.shortId, image.id, ...image.repoTags, ...image.repoDigests].join(' ').toLowerCase()

export const RuntimeImagePicker = ({
  images,
  value,
  onChange,
  disabled = false,
  placeholder
}: RuntimeImagePickerProps) => {
  const listId = useId()
  const selectedImage = findPlatformImageByReference(images, value)
  const query = value.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!images.length) return []
    const filtered = query ? images.filter(image => imageSearchText(image).includes(query)) : images
    return filtered.slice(0, 6)
  }, [images, query])

  return (
    <div className='flex w-full min-w-0 flex-col gap-3'>
      <div className='relative'>
        <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          className='pl-9'
          value={value}
          list={listId}
          readOnly={disabled}
          placeholder={placeholder}
          onChange={event => (!disabled ? onChange(event.target.value) : undefined)}
        />
        <datalist id={listId}>
          {images.map(image => {
            const label = imageDisplayName(image)
            return (
              <option
                key={image.id}
                value={label}
              />
            )
          })}
        </datalist>
      </div>

      {selectedImage ? <RuntimeImageBadges image={selectedImage} /> : null}

      {matches.length > 0 ? (
        <div className='grid gap-2'>
          {matches.map(image => {
            const label = imageDisplayName(image)
            const selected = selectedImage?.id === image.id
            return (
              <Button
                key={image.id}
                type='button'
                variant='input'
                className={cn(
                  'h-auto min-h-12 justify-start px-3 py-2 text-left',
                  selected ? 'border-primary/60 bg-primary/10' : null
                )}
                disabled={disabled}
                onClick={() => onChange(label)}
              >
                <IconBox className='size-4 text-muted-foreground' />
                <span className='flex min-w-0 flex-1 flex-col gap-1'>
                  <span className='truncate font-mono text-xs font-semibold'>{label}</span>
                  <RuntimeImageBadges image={image} />
                </span>
              </Button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
