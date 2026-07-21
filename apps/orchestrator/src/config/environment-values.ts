export const environmentBoolean = (
  value: string | undefined,
  fallback: boolean,
) => {
  if (value === undefined) return fallback;
  const normalized = value.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`Expected a boolean environment value, received "${value}".`);
};

export const environmentNumber = (
  value: string | undefined,
  fallback: number,
) => {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const environmentCsv = (
  value: string | undefined,
  fallback: string[],
) => {
  if (value === undefined || value.trim() === '') return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};
