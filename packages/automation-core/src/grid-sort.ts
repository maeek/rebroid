const sortFields = {
  workflows: new Set([
    "name",
    "lastRunAt",
    "lastStatus",
    "createdAt",
    "updatedAt",
  ]),
  triggers: new Set([
    "name",
    "enabled",
    "nextRunAt",
    "lastRunAt",
    "lastStatus",
    "updatedAt",
  ]),
};

export function parseAutomationGridSort(
  sort: string | undefined,
  grid: keyof typeof sortFields,
) {
  const fields = sortFields[grid];
  return (sort || "updatedAt:desc")
    .split(",")
    .flatMap((part) => {
      const [id, direction] = part.split(":");
      return id && fields.has(id) ? [{ id, desc: direction !== "asc" }] : [];
    })
    .slice(0, 3);
}
