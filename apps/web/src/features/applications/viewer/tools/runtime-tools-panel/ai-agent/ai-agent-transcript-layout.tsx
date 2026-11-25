import type { ReactNode, RefObject } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const AiAgentTranscriptLayout = ({
  children,
  scrollAction,
  transcriptRef,
  onTranscriptScroll
}: {
  children: ReactNode
  scrollAction?: ReactNode
  transcriptRef?: RefObject<HTMLDivElement | null>
  onTranscriptScroll?: () => void
}) => (
  <div className='relative flex min-h-0 flex-1 flex-col'>
    <div
      ref={transcriptRef}
      aria-label='AI agent transcript'
      role='region'
      // This scroll region must be reachable for keyboard scrolling.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className='scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto transform-gpu rounded-control py-4 focus-visible:outline-2 focus-visible:outline-ring'
      onScroll={onTranscriptScroll}
    >
      <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-1'>{children}</div>
    </div>
    {scrollAction}
  </div>
)

export const AiAgentTranscriptSkeleton = () => (
  <div
    aria-label='Loading AI chat history'
    className='grid gap-3'
  >
    {Array.from({ length: 3 }, (_, index) => (
      <div
        key={index}
        className='grid gap-3 py-4'
      >
        <div className='flex items-center gap-2'>
          <Skeleton className='size-6 rounded-full' />
          <Skeleton className='h-3 w-28' />
        </div>
        <Skeleton className='h-3 w-full' />
        <Skeleton className='h-3 w-4/5' />
      </div>
    ))}
  </div>
)
