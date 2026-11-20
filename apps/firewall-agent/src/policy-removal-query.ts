type PolicyRemovalQuery = {
  expectedContainerId?: string;
  generation?: number;
  revision?: number;
};

const isNonnegativeInteger = (value: string) =>
  /^\d+$/.test(value) && Number.isSafeInteger(Number(value));

export const parsePolicyRemovalQuery = (
  query: string | undefined,
): PolicyRemovalQuery | null => {
  if (query === undefined) return {};

  const params = new URLSearchParams(query);
  const containerIds = params.getAll("containerId");
  const generations = params.getAll("generation");
  const revisions = params.getAll("revision");
  if (
    params.size === 0 ||
    containerIds.length > 1 ||
    containerIds.includes("") ||
    generations.length > 1 ||
    revisions.length > 1 ||
    params.size !==
      containerIds.length + generations.length + revisions.length ||
    (generations.length > 0 &&
      (!containerIds.length || !isNonnegativeInteger(generations[0]))) ||
    (revisions.length > 0 && !isNonnegativeInteger(revisions[0]))
  ) {
    return null;
  }

  return {
    expectedContainerId: containerIds[0],
    generation: generations.length ? Number(generations[0]) : undefined,
    revision: revisions.length ? Number(revisions[0]) : undefined,
  };
};
