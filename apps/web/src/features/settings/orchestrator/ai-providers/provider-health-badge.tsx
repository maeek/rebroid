'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Surface, type SurfaceTone } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { AiHealthBadge } from '@/shared/ui/ai/ai-health-indicator'
import type { AutomationAiProvider, AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

const healthTone = (health: AutomationAiProviderHealth | null): SurfaceTone => {
  if (health?.status === 'ok') return 'success'
  if (health?.status === 'error') return 'danger'
  return 'neutral'
}

const healthMessage = (health: AutomationAiProviderHealth | null, isChecking: boolean) => {
  if (isChecking && !health) return 'Checking selected provider/model...'
  if (health?.message) return health.message
  return 'Health has not been checked yet.'
}

const healthCache = new Map<string, AutomationAiProviderHealth>()

const healthCacheKey = (provider: AutomationAiProvider, modelId?: string) =>
  JSON.stringify([
    provider.id,
    provider.baseUrl,
    provider.protocol,
    provider.serverFlavor,
    provider.enabled,
    modelId,
    provider.models
  ])

type HealthCheckActivity = 'auto' | 'manual'

const useProviderHealth = (provider: AutomationAiProvider, selectedModelId?: string, autoCheck = false) => {
  const cacheKey = healthCacheKey(provider, selectedModelId)
  const currentCacheKeyRef = useRef(cacheKey)
  const activeCheckKeyRef = useRef<string | null>(null)
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(() => healthCache.get(cacheKey) ?? null)
  const [checkingActivity, setCheckingActivity] = useState<HealthCheckActivity | null>(null)

  useEffect(() => {
    currentCacheKeyRef.current = cacheKey
  }, [cacheKey])

  const setCachedHealth = useCallback(
    (nextHealth: AutomationAiProviderHealth) => {
      healthCache.set(cacheKey, nextHealth)
      if (healthCache.size > 128) healthCache.delete(healthCache.keys().next().value ?? '')
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
    if (autoCheck && !healthCache.has(cacheKey)) void checkHealth('auto')
  }, [autoCheck, cacheKey, checkHealth])

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
  compact,
  disabled = false,
  autoCheck = false
}: {
  provider: AutomationAiProvider
  modelId?: string
  compact?: boolean
  disabled?: boolean
  autoCheck?: boolean
}) => {
  const selectedModelId =
    modelId ??
    provider.models.find(model => model.enabled && model.defaultFor.length > 0)?.id ??
    provider.models.find(model => model.enabled)?.id
  const { checkHealth, health, isChecking, isManualChecking } = useProviderHealth(provider, selectedModelId, autoCheck)

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
          size='icon-md'
          className='size-7 shrink-0'
          disabled={disabled || isManualChecking}
          aria-label='Check AI provider health'
          onClick={() => void checkHealth('manual')}
        >
          <IconRefresh
            className={cn('size-4', isManualChecking && 'animate-spin')}
            data-testid='provider-health-refresh-icon'
          />
        </Button>
      )}
    </div>
  )
}

export const ProviderHealthBanner = ({
  provider,
  disabled = false,
  autoCheck = false
}: {
  provider: AutomationAiProvider
  disabled?: boolean
  autoCheck?: boolean
}) => {
  const selectedModelId =
    provider.models.find(model => model.enabled && model.defaultFor.length > 0)?.id ??
    provider.models.find(model => model.enabled)?.id
  const { checkHealth, health, isChecking, isManualChecking } = useProviderHealth(provider, selectedModelId, autoCheck)

  return (
    <ProviderHealthBannerContent
      health={health}
      isChecking={isChecking}
      isManualChecking={isManualChecking}
      disabled={disabled}
      onCheck={() => void checkHealth('manual')}
    />
  )
}

export const ProviderHealthBannerContent = ({
  health = null,
  isChecking = false,
  isManualChecking = false,
  disabled = false,
  onCheck,
  loading = false
}: {
  health?: AutomationAiProviderHealth | null
  isChecking?: boolean
  isManualChecking?: boolean
  disabled?: boolean
  onCheck?: () => void
  loading?: boolean
}) => {
  return (
    <Surface
      level='band'
      tone={loading ? 'neutral' : healthTone(health)}
      className='flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3'
    >
      <div className='flex min-w-0 flex-wrap items-center gap-3'>
        {loading ? (
          <Skeleton className='h-5.5 w-16' />
        ) : (
          <AiHealthBadge
            health={health}
            isChecking={isChecking && !health}
          />
        )}
        <span className='min-w-0 break-words text-sm text-foreground-muted'>
          {loading ? (
            <Skeleton
              as='span'
              className='block h-5 w-40 max-w-full'
            />
          ) : (
            healthMessage(health, isChecking)
          )}
        </span>
      </div>
      <MutationButton
        type='button'
        variant='ghost'
        pending={isManualChecking}
        pendingLabel='Checking…'
        disabled={disabled || loading}
        aria-label='Check AI provider health'
        onClick={onCheck}
      >
        <IconRefresh className='size-4' /> Check connection
      </MutationButton>
    </Surface>
  )
}
