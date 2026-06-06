export const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const nullableText = (value: unknown) => text(value) || null;

export const nullableNumber = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null;
};

export const nullableInteger = (value: unknown, min: number, max: number) => {
  const number = nullableNumber(value, min, max);
  return number === null ? null : Math.round(number);
};
