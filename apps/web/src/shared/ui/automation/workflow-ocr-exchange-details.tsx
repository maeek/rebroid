import Image from 'next/image'
import { z } from 'zod'
import { JsonViewer } from '@/shared/ui/json-viewer'

const exchangeSchema = z.object({
  request: z.record(z.string(), z.unknown()),
  response: z.record(z.string(), z.unknown())
})

const previewSchema = z.object({
  dataUrl: z
    .string()
    .max(32_792)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
  width: z.number().int().min(1).max(320),
  height: z.number().int().min(1).max(320)
})

export function WorkflowOcrExchangeDetails({ data }: { data: Record<string, unknown> }) {
  const exchange = exchangeSchema.safeParse(data)
  const preview = previewSchema.safeParse(data.preview)
  if (!exchange.success) {
    return (
      <JsonViewer
        value={data}
        title='Event data'
      />
    )
  }

  return (
    <div className='grid min-w-0 gap-4'>
      {preview.success ? (
        <figure className='grid w-fit max-w-full gap-2'>
          <Image
            src={preview.data.dataUrl}
            alt='Android screenshot sent for text recognition'
            width={preview.data.width}
            height={preview.data.height}
            unoptimized
            className='h-auto max-w-full rounded-control'
          />
          <figcaption className='text-xs text-foreground-muted'>Submitted screenshot preview</figcaption>
        </figure>
      ) : null}
      <div className='grid min-w-0 gap-3 lg:grid-cols-2'>
        <JsonViewer
          value={exchange.data.request}
          title='OCR request'
        />
        <JsonViewer
          value={exchange.data.response}
          title='OCR response'
        />
      </div>
    </div>
  )
}
