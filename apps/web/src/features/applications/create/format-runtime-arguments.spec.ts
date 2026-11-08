import { describe, expect, it } from 'vitest'
import { formatRuntimeArguments } from './format-runtime-arguments'

describe('runtime argument display', () => {
  it('continues each argument onto the next line without leaving an unfinished continuation', () => {
    expect(formatRuntimeArguments('androidboot.redroid_width=1080 androidboot.redroid_height=2340 ro.secure=0')).toBe(
      ['androidboot.redroid_width=1080', 'androidboot.redroid_height=2340', 'ro.secure=0'].join(' \\\n')
    )
  })

  it('quotes whitespace, shell expansions, and apostrophes as literal arguments', () => {
    expect(formatRuntimeArguments('name="My device" value="$HOME; echo hello" owner="it\'s mine"')).toBe(
      ["'name=My device'", "'value=$HOME; echo hello'", "'owner=it'\"'\"'s mine'"].join(' \\\n')
    )
  })

  it('handles empty and single argument previews', () => {
    expect(formatRuntimeArguments('  ')).toBe('')
    expect(formatRuntimeArguments('ro.secure=0')).toBe('ro.secure=0')
  })
})
