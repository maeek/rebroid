import { expect, test } from '@playwright/test'

test('workflow controls share neutral surfaces across themes and accents', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' })
  const name = page.getByRole('textbox', { name: /^Name/ })
  await expect(name).toBeVisible()
  for (const theme of ['light', 'dark', 'oled']) {
    let neutralSurfaces: unknown
    const selections = new Set<string>()
    for (const accent of ['blue', 'cyan', 'green', 'purple', 'pink', 'red', 'amber']) {
      await page.evaluate(
        ({ theme: mode, accent: color }) => {
          document.documentElement.classList.remove('light', 'dark', 'oled')
          document.documentElement.classList.add(mode)
          document.documentElement.dataset.accent = color
          document.documentElement.style.colorScheme = mode === 'light' ? 'light' : 'dark'
        },
        { theme, accent }
      )
      const colors = await page.evaluate(() => {
        const background = (node: Element | null) => {
          if (!node) throw new Error('Missing theme preview element')
          return getComputedStyle(node).backgroundColor
        }
        const panel = document.querySelector('#automation-name')?.closest('section')
        return {
          canvas: background(document.body),
          panel: background(panel ?? null),
          input: background(document.querySelector('#automation-name')),
          textarea: background(document.querySelector('textarea')),
          catalog: background(document.querySelector('input[role="combobox"]')),
          selected: background(document.querySelector('[data-automation-step-item="true"] > .group'))
        }
      })
      const { selected, ...neutrals } = colors
      selections.add(selected)
      expect(colors.input).toBe(colors.textarea)
      expect(colors.catalog).toBe(colors.input)
      expect(colors.panel).not.toBe(colors.canvas)
      expect(colors.panel).not.toBe(colors.input)
      expect(colors.panel).not.toBe('rgba(0, 0, 0, 0)')
      if (neutralSurfaces) expect(neutrals).toEqual(neutralSurfaces)
      neutralSurfaces = neutrals
      if (accent === 'green' || accent === 'purple') {
        await page.screenshot({
          path: testInfo.outputPath(`workflow-${theme}-${accent}.png`),
          fullPage: true,
          animations: 'disabled'
        })
      }
    }
    expect(selections.size).toBe(7)
    await name.focus()
    await expect(name).toBeFocused()
  }
})
