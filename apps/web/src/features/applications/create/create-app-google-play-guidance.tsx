import type { ReactNode } from 'react'
import { IconCheck, IconHelpCircle } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import { recommendGooglePlayImage } from './google-play-image-recommendation'
import type { UploadedApk } from '@/shared/contracts/application'
import type { PlatformImage } from '@/shared/contracts/platform'

const verdictCopy = {
  required: {
    title: 'Google Play services required',
    description: 'The APK manifest contains a direct Google services declaration.'
  },
  likely: {
    title: 'Google Play services likely',
    description: 'The APK code references Google Play, Play Core, Play Integrity, or Firebase Messaging.'
  },
  not_detected: {
    title: 'No Google Play dependency detected',
    description:
      'Static analysis found no known signal. This is not a guarantee that every feature works without Play services.',
    icon: <IconCheck className='size-5' />
  },
  unknown: {
    title: 'Google Play compatibility unknown',
    description: 'The APK could not be fully analyzed, but the upload remains valid.',
    icon: <IconHelpCircle className='size-5' />
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
  const needsGapps = analysis.verdict === 'required' || analysis.verdict === 'likely'

  const recommendation = needsGapps ? recommendGooglePlayImage(images, selectedImage) : null
  let action: ReactNode = null

  if (recommendation && canChangeImage) {
    action = (
      <Button
        size='sm'
        type='button'
        onClick={() => onUseImage(imageDisplayName(recommendation))}
      >
        Use recommended image
      </Button>
    )
  } else if (needsGapps && !recommendation && canBuildImages) {
    action = (
      <Button
        size='sm'
        type='button'
        asChild
      >
        <Link href={`/runtime/images/build?${new URLSearchParams({ apk: uploadedApk.id }).toString()}`}>
          Build Google Play image
        </Link>
      </Button>
    )
  }

  return (
    <Notice
      tone={needsGapps ? 'warning' : 'info'}
      title={copy.title}
      description={copy.description}
      icon={'icon' in copy ? copy.icon : undefined}
      actions={action}
    />
  )
}
