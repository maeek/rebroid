import { useMemo, useState } from 'react'
import { IconBox, IconCheck, IconChevronDown, IconSearch } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import {
  findPlatformImageByReference,
  resolvePlatformImageRuntimeMetadata
} from '@/shared/model/runtime-image/runtime-image-metadata'
import type { PlatformImage } from '@/shared/contracts/platform-image'

type RuntimeImagePickerProps = {
  images: PlatformImage[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

const imageSearchText = (image: PlatformImage) =>
  [imageDisplayName(image), image.shortId, image.id, ...image.repoTags, ...image.repoDigests].join(' ').toLowerCase()

const runtimeImageSummary = (image: PlatformImage) => {
  const { metadata } = resolvePlatformImageRuntimeMetadata(image)
  const parts: string[] = []
  if (metadata.androidVersion) parts.push(`Android ${metadata.androidVersion}`)
  if (metadata.architecture) parts.push(metadata.architecture)
  if (metadata.gmsMode === 'gapps') parts.push('Google Play')
  if (metadata.gmsMode === 'microg') parts.push('microG')
  if (metadata.gmsMode === 'none') {
    parts.push(metadata.runtimeKind === 'redroid' ? 'No Google services' : 'Custom runtime')
  }
  return parts.join(' · ')
}

const isRuntimeImageCandidate = (image: PlatformImage) => {
  const { metadata } = resolvePlatformImageRuntimeMetadata(image)
  return metadata.runtimeKind === 'redroid' || image.runtimeMetadataSource === 'stored'
}

export const RuntimeImagePicker = ({
  images,
  value,
  onChange,
  disabled = false,
  placeholder = 'Choose an image'
}: RuntimeImagePickerProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedImage = findPlatformImageByReference(images, value)
  const runtimeImages = useMemo(
    () => images.filter(image => isRuntimeImageCandidate(image) || image.id === selectedImage?.id),
    [images, selectedImage?.id]
  )
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = normalized
      ? runtimeImages.filter(image => imageSearchText(image).includes(normalized))
      : runtimeImages
    return filtered.slice(0, 12)
  }, [query, runtimeImages])

  const selectImage = (image: PlatformImage) => {
    onChange(imageDisplayName(image))
    setOpen(false)
    setQuery('')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
    >
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className='h-auto min-h-12 w-full max-w-3xl justify-between px-3 py-2 text-left'
        >
          <span className='flex min-w-0 items-center gap-3'>
            <IconBox className='size-4 text-foreground-muted' />
            <span className='flex min-w-0 flex-col'>
              <span className='truncate font-mono text-xs font-medium'>
                {selectedImage ? imageDisplayName(selectedImage) : value || placeholder}
              </span>
              <span className='truncate text-xs font-normal text-foreground-muted'>
                {selectedImage ? runtimeImageSummary(selectedImage) : 'Image metadata unavailable'}
              </span>
            </span>
          </span>
          <IconChevronDown className='size-4 text-foreground-muted' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
        collisionPadding={12}
        sideOffset={6}
        className='w-[var(--anchor-width)] max-w-[calc(100vw-1.5rem)] p-1.5'
      >
        <div className='grid gap-2'>
          <div className='relative'>
            <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted' />
            <Input
              className='pl-9'
              value={query}
              placeholder='Filter runtime images'
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          <div
            className='grid max-h-[min(20rem,var(--available-height))] gap-0.5 overflow-auto overscroll-contain'
            role='listbox'
            aria-label='Runtime images'
          >
            {matches.map(image => {
              const selected = selectedImage?.id === image.id
              return (
                <Button
                  key={image.id}
                  type='button'
                  variant='ghost'
                  role='option'
                  aria-selected={selected}
                  className={cn(
                    'h-auto min-h-11 justify-start gap-2 px-2 py-2 text-left',
                    selected ? 'bg-primary/10' : null
                  )}
                  onClick={() => selectImage(image)}
                >
                  <span className='flex size-5 items-center justify-center'>
                    {selected ? <IconCheck className='size-4 text-primary' /> : null}
                  </span>
                  <span className='flex min-w-0 flex-1 flex-col'>
                    <span className='truncate font-mono text-xs font-medium'>{imageDisplayName(image)}</span>
                    <span className='truncate text-xs font-normal text-foreground-muted'>
                      {runtimeImageSummary(image)}
                    </span>
                  </span>
                </Button>
              )
            })}
            {matches.length === 0 ? (
              <div className='px-3 py-6 text-center text-sm text-foreground-muted'>No matching images.</div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
