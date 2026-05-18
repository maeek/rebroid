export const hasDockerStatusCode = (error: unknown, statusCode: number) =>
  typeof error === 'object' &&
  error !== null &&
  'statusCode' in error &&
  error.statusCode === statusCode;

export const formatContainerCommandFailureMessage = ({
  command,
  exitCode,
  stdout,
  stderr,
}: {
  command: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
}) => {
  const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join(' ').trim();
  return detail
    ? `Container command failed with exit code ${exitCode}: ${command.join(' ')} ${detail}`
    : `Container command failed with exit code ${exitCode}: ${command.join(' ')}`;
};