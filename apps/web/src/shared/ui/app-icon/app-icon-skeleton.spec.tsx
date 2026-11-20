import type { CSSProperties, ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { appIconSquircleStyle } from '@/shared/ui/app-icon/app-icon-shape'
import { AppIconSkeleton } from '@/shared/ui/app-icon/app-icon-skeleton'

describe('AppIconSkeleton', () => {
  it('uses the same squircle mask as the ready app icon', () => {
    render(
      <AppIcon
        appId='app-1'
        appName='Maps'
      />
    )
    const appIconSkeleton = AppIconSkeleton({}) as ReactElement<{ style: CSSProperties }>

    expect(screen.getByText('MAP').style.maskImage).toBe(appIconSquircleStyle.maskImage)
    expect(appIconSkeleton.props.style.maskImage).toBe(appIconSquircleStyle.maskImage)
  })
})
