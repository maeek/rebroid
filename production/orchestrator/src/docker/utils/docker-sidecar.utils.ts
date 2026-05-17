const ignoredBuildContextEntries = new Set([
  '.git',
  'node_modules',
  'dist',
  'npm-debug.log',
]);

export const shouldIgnoreBuildContextEntry = (name: string) =>
  ignoredBuildContextEntries.has(name);

export const isTransientAdbConnectionError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to connect') ||
    normalized.includes('connection refused') ||
    normalized.includes('cannot connect') ||
    normalized.includes('no route to host') ||
    normalized.includes('device offline')
  );
};