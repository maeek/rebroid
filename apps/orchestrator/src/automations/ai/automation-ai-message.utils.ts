import type { ChatMessage } from '../../common/ai-provider-request';

export const textContent = (content: ChatMessage['content']) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
      : '';
