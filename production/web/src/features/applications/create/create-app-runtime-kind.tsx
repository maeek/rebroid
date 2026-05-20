import { Badge } from '@/components/ui/badge'

export const CreateAppRuntimeKind = ({ isRedroidRuntime }: { isRedroidRuntime: boolean }) => {
  return (
    <div className='flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/40 px-4 py-3 backdrop-blur-md'>
      <div>
        <p className='font-medium'>Runtime type</p>
        <p className='text-sm text-secondary-foreground'>
          {isRedroidRuntime
            ? 'Android container with Redroid defaults applied.'
            : 'Generic container runtime. Provide a long-running command when needed.'}
        </p>
      </div>
      <Badge variant={isRedroidRuntime ? 'default' : 'secondary'}>{isRedroidRuntime ? 'Redroid' : 'Custom'}</Badge>
    </div>
  )
}
