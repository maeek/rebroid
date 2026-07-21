import { IconAlertTriangle, IconCheck, IconHelpCircle, IconInfoCircle } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import {
  findPlatformImageByReference,
  resolvePlatformImageRuntimeMetadata
} from '@/shared/model/runtime-image/runtime-image-metadata'
import { recommendGooglePlayImage } from './google-play-image-recommendation'
import type { UploadedApk } from '@/shared/contracts/application'
import type { PlatformImage } from '@/shared/contracts/platform'

const verdictCopy = {
  required: {
    title: 'Google Play services required',
    description: 'The APK manifest contains a direct Google services declaration.',
    icon: IconAlertTriangle
  },
  likely: {
    title: 'Google Play services likely',
    description: 'The APK code references Google Play, Play Core, Play Integrity, or Firebase Messaging.',
    icon: IconInfoCircle
  },
  not_detected: {
    title: 'No Google Play dependency detected',
    description:
      'Static analysis found no known signal. This is not a guarantee that every feature works without Play services.',
    icon: IconCheck
  },
  unknown: {
    title: 'Google Play compatibility unknown',
    description: 'The APK could not be fully analyzed, but the upload remains valid.',
    icon: IconHelpCircle
  }
} as const

export const CreateAppGooglePlayGuidance = ({
  uploadedApk,
  images,
  selectedImage,
  canChangeImage,
  canBuildImages,
  onUseImage
}: {
  uploadedApk: UploadedApk
  images: PlatformImage[]
  selectedImage: string
  canChangeImage: boolean
  canBuildImages: boolean
  onUseImage: (image: string) => void
}) => {
  const analysis = uploadedApk.googlePlayServices
  const copy = verdictCopy[analysis.verdict]
  const Icon = copy.icon
  const selected = findPlatformImageByReference(images, selectedImage)
  const selectedHasGapps = selected ? resolvePlatformImageRuntimeMetadata(selected).metadata.gmsMode === 'gapps' : false
  const needsGapps = analysis.verdict === 'required' || analysis.verdict === 'likely'
  const recommendation = needsGapps && !selectedHasGapps ? recommendGooglePlayImage(images, selectedImage) : null

  return (
    <div
      className={cn(
        'rounded-panel border p-4 text-sm',
        needsGapps && !selectedHasGapps
          ? 'border-warning/45 bg-warning/8'
          : 'border-surface-border/70 bg-surface-panel/35'
      )}
    >
      <div className='flex gap-3'>
        <Icon className='mt-0.5 size-4 shrink-0' />
        <div className='min-w-0 flex-1'>
          <div className='font-medium'>{copy.title}</div>
          <p className='mt-1 text-foreground-muted'>{copy.description}</p>
          {needsGapps && selectedHasGapps ? (
            <p className='mt-2 text-success'>The selected image includes Google Play.</p>
          ) : null}
          {needsGapps && !selectedHasGapps ? (
            <div className='mt-3 flex flex-wrap gap-2'>
              {recommendation && canChangeImage ? (
                <Button
                  size='sm'
                  type='button'
                  onClick={() => onUseImage(imageDisplayName(recommendation))}
                >
                  Use recommended image
                </Button>
              ) : null}
              {!recommendation && canBuildImages ? (
                <Button
                  size='sm'
                  type='button'
                  asChild
                >
                  <Link href={`/runtime/images/build?${new URLSearchParams({ apk: uploadedApk.id }).toString()}`}>
                    Build Google Play image
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
