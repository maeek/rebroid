import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { accentColorPresets } from '@/shared/model/theme/accent-color'

export const dynamic = 'force-static'
export const dynamicParams = false

export const generateStaticParams = () => accentColorPresets.map(({ id }) => ({ accent: id }))

export const GET = async (_request: Request, { params }: { params: Promise<{ accent: string }> }) => {
  const { accent } = await params
  const preset = accentColorPresets.find(({ id }) => id === accent)
  if (!preset) return new Response(null, { status: 404 })

  const [hue] = preset.swatch.split(' ')
  const colors = [
    `--icon-light: hsl(${hue} 85% 69%)`,
    `--icon-accent: hsl(${preset.swatch})`,
    `--icon-shade: hsl(${hue} 78% 46%)`,
    '--icon-glint: #fff',
    '--icon-ink: #111827'
  ].join('; ')

  const svg = await readFile(join(process.cwd(), 'public', 'rebroid-icon.svg'), 'utf8')
  return new Response(svg.replace('<svg ', `<svg style="${colors}" `), {
    headers: { 'Content-Type': 'image/svg+xml' }
  })
}
