import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { ProviderHealthBannerContent } from '@/features/settings/orchestrator/ai-providers/provider-health-badge'
import { ServiceDetailLayout } from '@/shared/ui/platform/service-detail-layout'
import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'

describe('neutral loading content', () => {
  it.each(['info', 'success', 'warning', 'danger'] as const)(
    'keeps a %s notice neutral and silent until its content is ready',
    tone => {
      const view = renderToStaticMarkup(
        <Notice
          loading
          tone={tone}
          title={<Skeleton className='h-5 w-20' />}
        />
      )
      expect(view).toContain('data-tone="neutral"')
      expect(view).toContain('aria-busy="true"')
      expect(view).not.toContain('<svg')
      expect(view).not.toMatch(/role="(alert|status)"/)
      expect(view).not.toContain('aria-live')

      render(
        <Notice
          tone={tone}
          title='Loaded notice'
        />
      )
      expect(screen.getByRole(tone === 'danger' ? 'alert' : 'status')).toHaveAttribute('data-tone', tone)
    }
  )

  it.each(['primary', 'success', 'warning', 'danger'] as const)(
    'does not color a %s metric marker before the metric is available',
    tone => {
      const view = renderToStaticMarkup(
        <QuickGlanceCard
          loading
          tone={tone}
          label='Events'
          value={7}
          hint='Loaded metric'
        />
      )
      expect(view).not.toContain('>7<')
      expect(view).not.toContain('Loaded metric')
      expect(view).toContain('bg-foreground-subtle')
      expect(view).not.toContain(`bg-${tone}`)

      render(
        <QuickGlanceCard
          tone={tone}
          label='Events'
          value={7}
          hint='Loaded metric'
        />
      )
      expect(screen.getByText('7')).toBeVisible()
      expect(
        renderToStaticMarkup(
          <QuickGlanceCard
            tone={tone}
            label='Events'
            value={7}
            hint='Loaded metric'
          />
        )
      ).toContain(`bg-${tone}`)
    }
  )

  it('masks cached provider health while rendering a loading banner', () => {
    const health = { providerId: 'local', status: 'ok' as const, message: 'Healthy', checkedAt: '2026-01-01T00:00:00Z' }
    const view = renderToStaticMarkup(
      <ProviderHealthBannerContent
        loading
        health={health}
      />
    )
    expect(view).toContain('data-tone="neutral"')
    expect(view).not.toContain('Online')
    expect(view).not.toContain('Healthy')
    expect(view).toContain('disabled=""')

    render(<ProviderHealthBannerContent health={health} />)
    expect(renderToStaticMarkup(<ProviderHealthBannerContent health={health} />)).toContain('data-tone="success"')
    expect(screen.getByText('Online')).toBeVisible()
  })

  it.each(['healthy', 'offline'] as const)('does not infer %s service status during loading', status => {
    const view = renderToStaticMarkup(
      <ServiceDetailLayout
        title='Service'
        refresh={null}
        loading
        health={{ status, ok: status === 'healthy', message: 'Ready' }}
      >
        Connection
      </ServiceDetailLayout>
    )
    expect(view).toContain('bg-control/60')
    expect(view).not.toMatch(/data-tone="(success|danger|warning|info)"/)
    expect(view).not.toContain('Ready')
    expect(view).not.toContain('Healthy')
    expect(view).not.toMatch(/role="(alert|status)"/)
  })
})
