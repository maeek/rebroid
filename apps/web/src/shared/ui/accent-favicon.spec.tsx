import { render, waitFor } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { applyAccentColorPreference } from '@/shared/model/theme/use-accent-color'
import { AccentFavicon } from './accent-favicon'

afterEach(() => applyAccentColorPreference('blue'))

// eslint-disable-next-line testing-library/no-node-access -- Favicon metadata is outside the accessible page.
const icons = () => document.head.querySelectorAll('link[rel="icon"]')

it('uses the original icon while signed out even when the document has an accent', () => {
  applyAccentColorPreference('purple')
  const { rerender } = render(<AccentFavicon initialAccentColor={null} />)

  expect(icons()).toHaveLength(1)
  expect(icons()[0]).toHaveAttribute('href', '/rebroid-icon.svg')

  rerender(<AccentFavicon initialAccentColor='purple' />)
  expect(icons()[0]).toHaveAttribute('href', '/favicon/purple')

  rerender(<AccentFavicon initialAccentColor={null} />)
  expect(icons()).toHaveLength(1)
  expect(icons()[0]).toHaveAttribute('href', '/rebroid-icon.svg')
})

it('keeps a single tab icon in sync with the document accent', async () => {
  applyAccentColorPreference('purple')
  render(<AccentFavicon initialAccentColor='purple' />)

  expect(icons()).toHaveLength(1)
  expect(icons()[0]).toHaveAttribute('href', '/favicon/purple')

  applyAccentColorPreference('green')
  await waitFor(() => expect(icons()[0]).toHaveAttribute('href', '/favicon/green'))
  expect(icons()).toHaveLength(1)

  applyAccentColorPreference('blue')
  await waitFor(() => expect(icons()[0]).toHaveAttribute('href', '/favicon/blue'))
})
