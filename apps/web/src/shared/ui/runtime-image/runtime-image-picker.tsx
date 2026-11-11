import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { defaultImageReferenceSchema } from '@/shared/contracts/ui-settings'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import {
  findPlatformImageByReference,
  resolvePlatformImageRuntimeMetadata
} from '@/shared/model/runtime-image/runtime-image-metadata'
import type { PlatformImage } from '@/shared/contracts/platform'

type RuntimeImagePickerProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  allowCustomReference?: boolean
  images: PlatformImage[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

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

const createImageReferenceOption = (query: string) => {
  const reference = defaultImageReferenceSchema.safeParse(query)
  return reference.success
    ? { value: reference.data, label: reference.data, description: 'Use this image reference' }
    : null
}

export const RuntimeImagePicker = ({
  allowCustomReference = false,
  images,
  value,
  onChange,
  disabled = false,
  placeholder = 'Choose an image',
  ...attributes
}: RuntimeImagePickerProps) => {
  const selectedImage = findPlatformImageByReference(images, value)
  const options = images
    .filter(image => isRuntimeImageCandidate(image) || image.id === selectedImage?.id)
    .map(image => ({
      value: imageDisplayName(image),
      label: imageDisplayName(image),
      description: runtimeImageSummary(image),
      keywords: [image.id, image.shortId, ...image.repoTags, ...image.repoDigests]
    }))
  if (value && !options.some(option => option.value === value))
    options.unshift({ value, label: value, description: 'Image metadata unavailable', keywords: [] })
  return (
    <SingleSelectCombobox
      {...attributes}
      options={options}
      createOption={allowCustomReference ? createImageReferenceOption : undefined}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
    />
  )
}
