'use client'

import { useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'

export const AiModelMenu = ({
  catalog,
  providerId,
  modelId,
  onSelect
}: {
  catalog: AutomationAiModelCatalogProvider[]
  providerId?: string
  modelId?: string
  onSelect: (providerId: string, modelId: string) => void
}) => {
  const [query, setQuery] = useState('')
  const count = catalog.reduce((total, provider) => total + provider.models.length, 0)
  const groups = catalog
    .map(provider => ({
      ...provider,
      models: provider.models.filter(model =>
        `${provider.label} ${model.label} ${model.id}`.toLowerCase().includes(query.toLowerCase().trim())
      )
    }))
    .filter(provider => provider.models.length > 0)
  return (
    <div className='grid gap-2'>
      {count > 6 ? (
        <Input
          aria-label='Search models'
          placeholder='Search models'
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
      ) : null}
      <div
        className='grid max-h-60 gap-3 overflow-y-auto overscroll-contain'
        aria-label='Available models'
      >
        {groups.map(provider => (
          <div
            key={provider.id}
            className='grid gap-1'
            role='group'
            aria-label={provider.label}
          >
            <p className='px-2 pt-1 text-xs text-foreground-muted'>{provider.label}</p>
            {provider.models.map(model => {
              const selected = provider.id === providerId && model.id === modelId
              return (
                <Button
                  key={model.id}
                  variant='ghost'
                  className='h-auto min-h-9 w-full justify-between gap-3 px-2 py-2 text-left font-normal aria-pressed:bg-primary/14 aria-pressed:hover:bg-primary/22'
                  aria-pressed={selected}
                  onClick={() => onSelect(provider.id, model.id)}
                >
                  <span className='min-w-0 break-words [overflow-wrap:anywhere]'>{model.label || model.id}</span>
                  <span className='flex size-4 shrink-0 items-center justify-center'>
                    {selected ? <IconCheck className='size-4 text-primary' /> : null}
                  </span>
                </Button>
              )
            })}
          </div>
        ))}
        {groups.length === 0 ? (
          <p
            className='px-2 py-3 text-xs text-foreground-muted'
            role='status'
          >
            {count ? 'No matching models.' : 'No enabled AI provider or model is configured.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
