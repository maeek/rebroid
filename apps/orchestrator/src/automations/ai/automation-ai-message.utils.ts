export const textContent = (content: unknown) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .flatMap((part: unknown) => {
            if (
              !part ||
              typeof part !== 'object' ||
              !('type' in part) ||
              part.type !== 'text'
            )
              return [];
            return 'text' in part && typeof part.text === 'string'
              ? [part.text]
              : [];
          })
          .join('\n')
      : '';
