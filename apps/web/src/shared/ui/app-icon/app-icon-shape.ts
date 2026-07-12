import type { CSSProperties } from 'react'

const appIconSquircleMask =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Cpath fill=%27black%27 d=%27M50 0C14 0 0 14 0 50s14 50 50 50 50-14 50-50S86 0 50 0Z%27/%3E%3C/svg%3E")'

export const appIconSquircleStyle = {
  WebkitMaskImage: appIconSquircleMask,
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskSize: '100% 100%',
  maskImage: appIconSquircleMask,
  maskRepeat: 'no-repeat',
  maskSize: '100% 100%'
} satisfies CSSProperties
