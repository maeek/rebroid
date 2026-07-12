import type { CSSProperties, ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { appIconSquircleStyle } from '@/shared/ui/app-icon/app-icon-shape'
import { AppIconSkeleton } from '@/shared/ui/app-icon/app-icon-skeleton'

describe('AppIconSkeleton', () => {
  it('uses the same squircle mask as the ready app icon', () => {
    const appIcon = AppIcon({ appId: 'app-1', appName: 'Maps' }) as ReactElement<{ style: CSSProperties }>
    const appIconSkeleton = AppIconSkeleton({}) as ReactElement<{ style: CSSProperties }>

    expect(appIcon.props.style.maskImage).toBe(appIconSquircleStyle.maskImage)
    expect(appIconSkeleton.props.style.maskImage).toBe(appIconSquircleStyle.maskImage)
  })
})
