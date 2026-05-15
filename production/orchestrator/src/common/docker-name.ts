const unsafeCharacters = /[^a-zA-Z0-9_.-]+/g;

export const dockerSafeName = (value: string, fallback = 'resource') => {
  const safe = value.replace(unsafeCharacters, '-').replace(/^-+|-+$/g, '');
  return safe.length > 0 ? safe.toLowerCase() : fallback;
};
