export const hasDockerStatusCode = (error: unknown, statusCode: number) =>
  typeof error === 'object' &&
  error !== null &&
  'statusCode' in error &&
  error.statusCode === statusCode;