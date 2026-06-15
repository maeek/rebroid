import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { AiAssistantMarkdownText } from './ai-message'

describe('AiAssistantMarkdownText', () => {
  it('renders safe markdown without raw HTML', () => {
    render(
      <AiAssistantMarkdownText
        text={'**Done**\n\n- One\n\n<a href="https://example.com">raw</a>\n\n[Link](https://example.com)'}
      />
    )

    expect(screen.getByText('Done').tagName.toLowerCase()).toBe('strong')
    expect(screen.getByText('One').tagName.toLowerCase()).toBe('li')
    expect(screen.getByRole('link', { name: 'Link' }).getAttribute('href')).toBe('https://example.com')
    expect(screen.queryByRole('link', { name: 'raw' })).toBeNull()
    expect(screen.getByText('raw').tagName.toLowerCase()).toBe('p')
  })

  it('renders JSON-like public assistant text as markdown rows', () => {
    render(<AiAssistantMarkdownText text={'{"Current screen":"Home","Goal":"Open Settings"}'} />)

    expect(screen.getByText('Current screen:')).toBeTruthy()
    expect(screen.getByText(/Home/)).toBeTruthy()
    expect(screen.queryByText(/"Current screen"/)).toBeNull()
  })

  it('renders plain public plan labels as markdown rows', () => {
    render(
      <AiAssistantMarkdownText
        text={[
          'Current screen: Home screen with search bar',
          'Goal: Turn on dark mode theme',
          'Next moves: Locate Settings using typed tools'
        ].join('\n')}
      />
    )

    expect(screen.getByText('Current screen:')).toBeTruthy()
    expect(screen.getByText('Goal:')).toBeTruthy()
    expect(screen.getByText('Next moves:')).toBeTruthy()
    expect(screen.queryByText(/\*\*Current screen:\*\*/)).toBeNull()
  })
})
