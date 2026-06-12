import type {
  AutomationDto,
  ListAutomationsGridQueryDto,
} from '../dto/automation.dto';
import type {
  AutomationTriggerDto,
  ListAutomationTriggersGridQueryDto,
} from '../dto/automation-trigger.dto';

export const tagNames = (value: { tags: { name: string }[] }) =>
  value.tags.map((tag) => tag.name);

export const automationGridFacets = (
  automations: AutomationDto[],
  targetApplicationIds: string[],
) => ({
  tags: [
    ...new Set(automations.flatMap((automation) => tagNames(automation))),
  ].sort((left, right) => left.localeCompare(right)),
  targetApplicationIds: [...new Set(targetApplicationIds)].sort((left, right) =>
    left.localeCompare(right),
  ),
});

export const automationTriggerGridFacets = (
  triggers: AutomationTriggerDto[],
) => ({
  tags: [...new Set(triggers.flatMap((trigger) => tagNames(trigger)))].sort(
    (left, right) => left.localeCompare(right),
  ),
  targetApplicationIds: [
    ...new Set(triggers.map((trigger) => trigger.targetApplicationId)),
  ].sort((left, right) => left.localeCompare(right)),
});

export const matchesAutomationLastRun = (
  automation: AutomationDto,
  filter: ListAutomationsGridQueryDto['lastRun'],
) => matchesLastRun(automation.lastRunAt, filter);

export const matchesAutomationTriggerLastRun = (
  trigger: AutomationTriggerDto,
  filter: ListAutomationTriggersGridQueryDto['lastRun'],
) => matchesLastRun(trigger.lastRunAt, filter);

export const filterAutomationGridItems = ({
  automations,
  lastRun,
  query,
  targetApplicationIdsByAutomation,
}: {
  automations: AutomationDto[];
  lastRun: ListAutomationsGridQueryDto['lastRun'];
  query: ListAutomationsGridQueryDto;
  targetApplicationIdsByAutomation: Map<string, Set<string>>;
}) => {
  const search = query.q?.trim().toLowerCase();
  const tag = query.tag?.trim();
  return automations.filter((automation) => {
    const targetApplicationIds =
      targetApplicationIdsByAutomation.get(automation.id) ?? new Set<string>();
    return (
      (!search ||
        [
          automation.name,
          automation.description,
          automation.lastStatus,
          ...tagNames(automation),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search)) &&
      (!tag || tagNames(automation).includes(tag)) &&
      (!query.status || automation.lastStatus === query.status) &&
      (!query.targetApplicationId ||
        targetApplicationIds.has(query.targetApplicationId)) &&
      matchesAutomationLastRun(automation, lastRun)
    );
  });
};

export const filterAutomationTriggerGridItems = ({
  automationNamesById,
  lastRun,
  query,
  triggers,
}: {
  automationNamesById: Map<string, string>;
  lastRun: ListAutomationTriggersGridQueryDto['lastRun'];
  query: ListAutomationTriggersGridQueryDto;
  triggers: AutomationTriggerDto[];
}) => {
  const search = query.q?.trim().toLowerCase();
  const tag = query.tag?.trim();
  return triggers.filter((trigger) => {
    const automationName = automationNamesById.get(trigger.automationId);
    return (
      (!search ||
        [
          trigger.name,
          trigger.targetApplicationId,
          trigger.profileName,
          trigger.lastStatus,
          automationName,
          ...tagNames(trigger),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search)) &&
      (!tag || tagNames(trigger).includes(tag)) &&
      (!query.targetApplicationId ||
        trigger.targetApplicationId === query.targetApplicationId) &&
      (!query.enabled || String(trigger.enabled) === query.enabled) &&
      (!query.status || trigger.lastStatus === query.status) &&
      matchesAutomationTriggerLastRun(trigger, lastRun)
    );
  });
};

export const sortAutomationGridItems = (
  items: AutomationDto[],
  sort?: string,
) =>
  sortGridItems(items, sort, automationGridSortFields, (left, right, id) => {
    if (id === 'name') return left.name.localeCompare(right.name);
    if (id === 'lastStatus') {
      return left.lastStatus.localeCompare(right.lastStatus);
    }
    if (id === 'lastRunAt') {
      return compareNullableDates(left.lastRunAt, right.lastRunAt);
    }
    if (id === 'createdAt')
      return compareDates(left.createdAt, right.createdAt);
    if (id === 'updatedAt')
      return compareDates(left.updatedAt, right.updatedAt);
    return 0;
  });

export const sortAutomationTriggerGridItems = (
  items: AutomationTriggerDto[],
  sort?: string,
) =>
  sortGridItems(
    items,
    sort,
    automationTriggerGridSortFields,
    (left, right, id) => {
      if (id === 'name') return left.name.localeCompare(right.name);
      if (id === 'enabled') return Number(left.enabled) - Number(right.enabled);
      if (id === 'lastStatus') {
        return left.lastStatus.localeCompare(right.lastStatus);
      }
      if (id === 'lastRunAt') {
        return compareNullableDates(left.lastRunAt, right.lastRunAt);
      }
      if (id === 'nextRunAt') {
        return compareNullableDates(left.nextRunAt, right.nextRunAt);
      }
      if (id === 'updatedAt')
        return compareDates(left.updatedAt, right.updatedAt);
      return 0;
    },
  );

const automationGridSortFields = new Set([
  'name',
  'lastRunAt',
  'lastStatus',
  'createdAt',
  'updatedAt',
]);

const automationTriggerGridSortFields = new Set([
  'name',
  'enabled',
  'nextRunAt',
  'lastRunAt',
  'lastStatus',
  'updatedAt',
]);

const matchesLastRun = (
  lastRunAt: string | null,
  filter:
    | ListAutomationsGridQueryDto['lastRun']
    | ListAutomationTriggersGridQueryDto['lastRun'],
) => {
  if (!filter || filter === 'all') return true;
  if (filter === 'never') return lastRunAt === null;
  if (!lastRunAt) return false;
  const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 90;
  return (
    new Date(lastRunAt).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000
  );
};

const sortGridItems = <TItem extends { id: string }>(
  items: TItem[],
  sort: string | undefined,
  allowedFields: Set<string>,
  compare: (left: TItem, right: TItem, id: string) => number,
) => {
  const sorting = (sort || 'updatedAt:desc')
    .split(',')
    .map((part) => {
      const [id, direction] = part.split(':');
      if (!id || !allowedFields.has(id)) return null;
      return { id, desc: direction !== 'asc' };
    })
    .filter((item): item is { id: string; desc: boolean } => Boolean(item))
    .slice(0, 3);

  return [...items].sort((left, right) => {
    for (const sortItem of sorting) {
      const result = compare(left, right, sortItem.id);
      if (result !== 0) return result * (sortItem.desc ? -1 : 1);
    }
    return left.id.localeCompare(right.id);
  });
};

const compareNullableDates = (left: string | null, right: string | null) => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return compareDates(left, right);
};

const compareDates = (left: string, right: string) =>
  new Date(left).getTime() - new Date(right).getTime();
