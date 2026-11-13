import type { CSSProperties } from 'react'
import Anser from 'anser'

// Keep control strings and cursor commands out of both the display and the clipboard.
const terminalControls = new RegExp(
  [
    String.raw`\r\n?`,
    String.raw`(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]`,
    String.raw`(?:\u001b[\]PX^_]|[\u0090\u0098\u009d-\u009f])[^\u0007\u001b\u009c]*(?:\u0007|\u001b\\|\u009c)?`,
    String.raw`\u001b(?:[ -/]*[@-Z\\-_])?`,
    String.raw`[\u0000-\u0008\u000b-\u000c\u000e-\u001a\u001c-\u001f\u007f-\u009f]`
  ].join('|'),
  'g'
)
// eslint-disable-next-line no-control-regex
const sgr = /^(?:\u001b\[|\u009b)\d{0,3}(?:;\d{0,3}){0,7}m$/
const maxStyleChanges = 1024

export const parseLogOutput = (output: string) => {
  let styleChanges = 0
  const text = output.replace(terminalControls, control => {
    if (control.startsWith('\r')) return '\n'
    // Bound the work Anser and React spend on styles in a dense log tail.
    if (sgr.test(control)) {
      styleChanges += 1
      if (styleChanges <= maxStyleChanges) return control.replace('\u009b', '\u001b[')
      if (styleChanges === maxStyleChanges + 1) return '\u001b[0m'
    }
    return ''
  })
  if (styleChanges === 0) return { text, content: text }

  const segments = Anser.ansiToJson(text, { remove_empty: true })
  return {
    text: segments.map(segment => segment.content).join(''),
    content: segments.map(({ content, fg, bg, decorations, was_processed }, index) => {
      if (!was_processed) return content

      const style: CSSProperties = {
        color: fg ? `rgb(${fg})` : undefined,
        backgroundColor: bg ? `rgb(${bg})` : undefined,
        fontWeight: decorations.includes('bold') ? 'bold' : undefined,
        fontStyle: decorations.includes('italic') ? 'italic' : undefined,
        textDecorationLine:
          [decorations.includes('underline') && 'underline', decorations.includes('strikethrough') && 'line-through']
            .filter(Boolean)
            .join(' ') || undefined
      }
      return (
        <span
          key={index}
          style={style}
        >
          {content}
        </span>
      )
    })
  }
}
