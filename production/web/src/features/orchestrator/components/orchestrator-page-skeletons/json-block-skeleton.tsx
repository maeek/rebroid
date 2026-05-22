import { Skeleton } from '@/components/ui/skeleton'

export const JsonBlockSkeleton = ({ lines = 10, dark = false }: { lines?: number; dark?: boolean }) => (
  <div className={dark ? 'rounded-lg bg-black/25 p-4' : 'rounded-lg bg-background/30 p-4'}>
    <div className='flex flex-col gap-3'>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-3 ${index === lines - 1 ? 'w-[46%]' : 'w-full'} ${dark ? 'bg-white/12' : ''}`}
        />
      ))}
    </div>
  </div>
)
