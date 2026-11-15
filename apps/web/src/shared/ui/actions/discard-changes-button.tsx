import { Button } from '@/components/ui/button'

export const DiscardChangesButton = ({ disabled, onClick }: { disabled?: boolean; onClick?: () => void }) => (
  <Button
    type='button'
    variant='ghost'
    aria-label='Discard changes'
    className='max-sm:px-2'
    disabled={disabled}
    onClick={onClick}
  >
    <span>
      Discard<span className='max-sm:hidden'> changes</span>
    </span>
  </Button>
)
