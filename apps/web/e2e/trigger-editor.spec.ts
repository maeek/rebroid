import { expect, test } from '@playwright/test'

test('trigger creation supports contextual resource search and reusable tags without overflow', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=triggers')
    const open = page.getByRole('button', { name: 'New trigger', exact: true })
    await open.click()
    const dialog = page.getByRole('dialog', { name: 'New trigger', exact: true })
    await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Nightly warehouse reconciliation.')
    const workflow = dialog.getByRole('combobox', { name: /^Workflow/ })
    await workflow.fill('warehouse')
    await expect(page.getByRole('option')).toHaveCount(1)
    await workflow.press('ArrowDown')
    await workflow.press('Enter')
    await expect(workflow).toHaveValue('Daily inventory check')
    await expect(workflow).toHaveAccessibleDescription(/warehouse-workflow/)
    const app = dialog.getByRole('combobox', { name: /^Target app/ })
    await app.fill('reports-app')
    await page.getByRole('option', { name: /Reports worker/ }).click()
    await expect(app).toHaveAccessibleDescription(/reports-app/)
    await expect(dialog.getByRole('textbox', { name: /^Name/ })).toHaveValue('Daily inventory check on Reports worker')

    const tags = dialog.getByRole('combobox', { name: 'Tags', exact: true })
    await tags.fill('smoke')
    await page.getByRole('option', { name: 'smoke', exact: true }).click()
    await tags.fill('Release QA')
    await page.getByRole('option', { name: 'Create “Release QA”', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Remove Release QA', exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Remove smoke', exact: true })).toBeVisible()
    await tags.click()
    await tags.press('Escape')
    await expect(dialog).toBeVisible()

    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      await dialog.evaluate(node => {
        node.scrollTop = 0
      })
      await expect(dialog.getByRole('textbox', { name: /^Name/ })).toBeInViewport()
      expect(await dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-trigger-create-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
      const save = dialog.getByRole('button', { name: 'Create trigger', exact: true })
      await save.scrollIntoViewIfNeeded()
      await expect(save).toBeEnabled()
      await expect(save).toBeInViewport()
    }
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(open).toBeFocused()
    await open.click()
    await expect(dialog.getByRole('textbox', { name: 'Description', exact: true })).toBeEmpty()
    await expect(dialog.getByRole('button', { name: 'Remove Release QA', exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
  expect(errors).toEqual([])
})
