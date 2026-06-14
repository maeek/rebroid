'use client'

import { useEffect, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AiHealthBadge } from '@/shared/ui/ai/ai-health-indicator'
import type { AutomationAiProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

const healthBannerClassName = (health: AutomationAiProviderHealth | null) =>
  health?.status === 'ok'
    ? 'border-success/30 bg-success/10'
    : health?.status === 'disabled'
      ? 'border-border/70 bg-surface-band/35'
      : health
        ? 'border-destructive/40 bg-destructive/10'
        : 'border-border/70 bg-surface-band/35'

const healthMessage = (health: AutomationAiProviderHealth | null, isChecking: boolean) => {
  if (isChecking && !health) return 'Checking selected provider/model...'
  if (health?.message) return health.message
  return 'Health has not been checked yet.'
}

const healthCache = new Map<string, AutomationAiProviderHealth>()

const healthCacheKey = (providerId: string, modelId?: string) => `${providerId}:${modelId ?? '__provider__'}`

export const ProviderHealthBadge = ({
  provider,
  modelId,
  compact
}: {
  provider: AutomationAiProvider
  modelId?: string
  compact?: boolean
}) => {
  const selectedModelId =
    modelId ??
    provider.models.find(model => model.enabled && model.default)?.id ??
    provider.models.find(model => model.enabled)?.id
  const cacheKey = healthCacheKey(provider.id, selectedModelId)
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(() => healthCache.get(cacheKey) ?? null)
  const [isChecking, setIsChecking] = useState(false)

  const checkHealth = async () => {
    setIsChecking(true)
    try {
      const { checkAutomationAiProviderHealthAction } = await import('@/server/orchestrator/settings/actions')
      const nextHealth = await checkAutomationAiProviderHealthAction(provider.id, selectedModelId)
      healthCache.set(cacheKey, nextHealth)
      setHealth(nextHealth)
    } catch (error) {
      const nextHealth = {
        providerId: provider.id,
        ...(selectedModelId ? { modelId: selectedModelId } : {}),
        status: 'error',
        message: error instanceof Error ? error.message : 'Health check failed.',
        checkedAt: new Date().toISOString()
      } satisfies AutomationAiProviderHealth
      healthCache.set(cacheKey, nextHealth)
      setHealth(nextHealth)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    setHealth(healthCache.get(cacheKey) ?? null)
    void checkHealth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id, selectedModelId])

  return (
    <div className={cn('flex min-w-0 items-center gap-2', compact && 'text-xs')}>
      <AiHealthBadge
        health={health}
        isChecking={isChecking && !health}
      />
      {compact ? null : (
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-7 shrink-0'
          disabled={isChecking}
          aria-label='Check AI provider health'
          onClick={() => void checkHealth()}
        >
          <IconRefresh className={cn('size-4', isChecking && 'animate-spin')} />
        </Button>
      )}
    </div>
  )
}

export const ProviderHealthBanner = ({ provider }: { provider: AutomationAiProvider }) => {
  const selectedModelId =
    provider.models.find(model => model.enabled && model.default)?.id ??
    provider.models.find(model => model.enabled)?.id
  const cacheKey = healthCacheKey(provider.id, selectedModelId)
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(() => healthCache.get(cacheKey) ?? null)
  const [isChecking, setIsChecking] = useState(false)

  const checkHealth = async () => {
    setIsChecking(true)
    try {
      const { checkAutomationAiProviderHealthAction } = await import('@/server/orchestrator/settings/actions')
      const nextHealth = await checkAutomationAiProviderHealthAction(provider.id, selectedModelId)
      healthCache.set(cacheKey, nextHealth)
      setHealth(nextHealth)
    } catch (error) {
      const nextHealth = {
        providerId: provider.id,
        ...(selectedModelId ? { modelId: selectedModelId } : {}),
        status: 'error',
        message: error instanceof Error ? error.message : 'Health check failed.',
        checkedAt: new Date().toISOString()
      } satisfies AutomationAiProviderHealth
      healthCache.set(cacheKey, nextHealth)
      setHealth(nextHealth)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    setHealth(healthCache.get(cacheKey) ?? null)
    void checkHealth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id, selectedModelId])

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md',
        healthBannerClassName(health)
      )}
    >
      <div className='flex min-w-0 flex-wrap items-center gap-3'>
        <AiHealthBadge
          health={health}
          isChecking={isChecking && !health}
        />
        <span className='min-w-0 break-words text-sm text-foreground-muted'>{healthMessage(health, isChecking)}</span>
      </div>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-7 shrink-0'
        disabled={isChecking}
        aria-label='Check AI provider health'
        onClick={() => void checkHealth()}
      >
        <IconRefresh className={cn('size-4', isChecking && 'animate-spin')} />
      </Button>
    </div>
  )
}
