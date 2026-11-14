import { useCallback, useEffect, useRef, useState } from 'react'

/** Follow appended output until the reader deliberately scrolls away. */
export const useFollowOutput = <T extends HTMLElement>(content: unknown, enabled = true) => {
  const outputRef = useRef<T | null>(null)
  const shouldFollow = useRef(true)
  const wasEnabled = useRef(enabled)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const onScroll = useCallback(() => {
    const output = outputRef.current
    const atBottom = !output || output.scrollHeight - output.scrollTop - output.clientHeight <= 80
    shouldFollow.current = atBottom
    setIsAtBottom(atBottom)
  }, [])

  const scrollToLatest = useCallback(() => {
    const output = outputRef.current
    if (output) {
      if (typeof output.scrollTo === 'function') output.scrollTo({ top: output.scrollHeight, behavior: 'instant' })
      else output.scrollTop = output.scrollHeight
    }
    shouldFollow.current = true
    setIsAtBottom(true)
  }, [])

  useEffect(() => {
    if (enabled && !wasEnabled.current) shouldFollow.current = true
    wasEnabled.current = enabled
    if (enabled && shouldFollow.current) scrollToLatest()
  }, [content, enabled, scrollToLatest])

  return { outputRef, onScroll, isAtBottom, scrollToLatest }
}
