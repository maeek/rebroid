export const getErrorMessage = (error: unknown, fallback = 'Unknown error') =>
  error instanceof Error ? error.message : fallback;
