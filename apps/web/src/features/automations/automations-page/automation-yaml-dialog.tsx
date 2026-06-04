'use client'

import { useEffect, useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export function AutomationYamlDialog({
  open,
  yaml,
  busy,
  onOpenChange,
  onApply
}: {
  open: boolean
  yaml: string
  busy: boolean
  onOpenChange: (open: boolean) => void
  onApply: (yaml: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(yaml)

  useEffect(() => {
    if (open) setDraft(yaml)
  }, [open, yaml])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>Edit YAML</DialogTitle>
          <DialogDescription className='sr-only'>Edit automation YAML.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={draft}
          className='min-h-[60dvh] font-mono text-xs'
          onChange={event => setDraft(event.target.value)}
        />
        <DialogFooter>
          <Button
            variant='secondary'
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => void onApply(draft)}
          >
            <IconCheck className='size-4' />
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
