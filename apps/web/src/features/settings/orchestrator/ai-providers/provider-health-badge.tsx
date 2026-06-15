'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

type HealthCheckActivity = 'auto' | 'manual'

const useProviderHealth = (provider: AutomationAiProvider, selectedModelId?: string) => {
  const cacheKey = healthCacheKey(provider.id, selectedModelId)
  const currentCacheKeyRef = useRef(cacheKey)
  const activeCheckKeyRef = useRef<string | null>(null)
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(() => healthCache.get(cacheKey) ?? null)
  const [checkingActivity, setCheckingActivity] = useState<HealthCheckActivity | null>(null)

  currentCacheKeyRef.current = cacheKey

  const setCachedHealth = useCallback(
    (nextHealth: AutomationAiProviderHealth) => {
      healthCache.set(cacheKey, nextHealth)
      if (currentCacheKeyRef.current === cacheKey) setHealth(nextHealth)
    },
    [cacheKey]
  )

  const checkHealth = useCallback(
    async (activity: HealthCheckActivity = 'manual') => {
      if (activeCheckKeyRef.current === cacheKey) {
        if (activity === 'manual' && currentCacheKeyRef.current === cacheKey) setCheckingActivity('manual')
        return
      }

      activeCheckKeyRef.current = cacheKey
      if (currentCacheKeyRef.current === cacheKey) setCheckingActivity(activity)

      try {
        const { checkAutomationAiProviderHealthAction } = await import('@/server/orchestrator/settings/actions')
        const nextHealth = await checkAutomationAiProviderHealthAction(provider.id, selectedModelId)
        setCachedHealth(nextHealth)
      } catch (error) {
        setCachedHealth({
          providerId: provider.id,
          ...(selectedModelId ? { modelId: selectedModelId } : {}),
          status: 'error',
          message: error instanceof Error ? error.message : 'Health check failed.',
          checkedAt: new Date().toISOString()
        })
      } finally {
        if (activeCheckKeyRef.current === cacheKey) activeCheckKeyRef.current = null
        if (currentCacheKeyRef.current === cacheKey) setCheckingActivity(null)
      }
    },
    [cacheKey, provider.id, selectedModelId, setCachedHealth]
  )

  useEffect(() => {
    setHealth(healthCache.get(cacheKey) ?? null)
    void checkHealth('auto')
  }, [cacheKey, checkHealth])

  return {
    checkHealth,
    health,
    isChecking: checkingActivity !== null,
    isManualChecking: checkingActivity === 'manual'
  }
}

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
    provider.models.find(model => model.enabled && model.defaultFor.length > 0)?.id ??
    provider.models.find(model => model.enabled)?.id
  const { checkHealth, health, isChecking, isManualChecking } = useProviderHealth(provider, selectedModelId)

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
          disabled={isManualChecking}
          aria-label='Check AI provider health'
          onClick={() => void checkHealth('manual')}
        >
          <IconRefresh className={cn('size-4', isManualChecking && 'animate-spin')} />
        </Button>
      )}
    </div>
  )
}

export const ProviderHealthBanner = ({ provider }: { provider: AutomationAiProvider }) => {
  const selectedModelId =
    provider.models.find(model => model.enabled && model.defaultFor.length > 0)?.id ??
    provider.models.find(model => model.enabled)?.id
  const { checkHealth, health, isChecking, isManualChecking } = useProviderHealth(provider, selectedModelId)

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
        disabled={isManualChecking}
        aria-label='Check AI provider health'
        onClick={() => void checkHealth('manual')}
      >
        <IconRefresh className={cn('size-4', isManualChecking && 'animate-spin')} />
      </Button>
    </div>
  )
}
