import { Skeleton } from '@/components/ui/skeleton'

export const JsonBlockSkeleton = ({ lines = 10, dark = false }: { lines?: number; dark?: boolean }) => (
  <div
    className={
      dark
        ? 'rounded-lg border border-border/60 bg-black/35 p-4'
        : 'rounded-lg border border-border/60 bg-background/45 p-4'
    }
  >
    <div className='flex flex-col gap-3'>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-3 ${index === lines - 1 ? 'w-[46%]' : 'w-full'} ${dark ? 'bg-white/10' : ''}`}
        />
      ))}
    </div>
  </div>
)
