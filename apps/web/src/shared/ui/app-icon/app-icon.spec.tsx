import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AppIcon } from './app-icon'

it('shows the default icon when the custom image fails to load', () => {
  const { rerender } = render(
    <AppIcon
      appId='app-1'
      appName='żappka'
      icon='/api/device-icons/app-1'
    />
  )

  fireEvent.error(screen.getByAltText(''))

  expect(screen.getByText('ŻAP')).toBeVisible()

  rerender(
    <AppIcon
      appId='app-1'
      appName='żappka'
      icon='/api/device-icons/app-1?v=new'
    />
  )
  expect(screen.getByAltText('').getAttribute('src')).toMatch(/\/api\/device-icons\/app-1\?v=new$/)
})
