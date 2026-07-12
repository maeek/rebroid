import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { appIconSquircleStyle } from '@/shared/ui/app-icon/app-icon-shape'

export const AppIconSkeleton = ({ className }: { className?: string }) => (
  <Skeleton
    className={cn('aspect-square overflow-hidden rounded-[24%]', className)}
    style={appIconSquircleStyle}
  />
)
