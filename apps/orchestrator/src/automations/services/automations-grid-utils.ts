import { parseAutomationGridSort } from '@rebroid/automation-core/grid-sort';
import type {
  AutomationSummaryDto,
  ListAutomationsGridQueryDto,
} from '../dto/automation.dto';
import type {
  AutomationTriggerDto,
  ListAutomationTriggersGridQueryDto,
} from '../dto/automation-trigger.dto';

const tagNames = (value: { tags: { name: string }[] }) =>
  value.tags.map((tag) => tag.name);

const sortedUnique = (values: string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const gridPage = <T extends { tags: { name: string }[] }>(
  sorted: T[],
  allRows: T[],
  targetDeviceIds: string[],
  query: { page?: number; pageSize?: number },
) => {
  const page = Math.max(Math.trunc(query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Math.trunc(query.pageSize ?? 20), 1), 100);
  const offset = (page - 1) * pageSize;
  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    page,
    pageSize,
    facets: {
      tags: sortedUnique(allRows.flatMap(tagNames)),
      targetDeviceIds: sortedUnique(targetDeviceIds),
    },
  };
};

export const buildAutomationGridPage = <T extends AutomationSummaryDto>(
  automations: T[],
  query: ListAutomationsGridQueryDto,
  targetDeviceIdsByAutomation: Map<string, Set<string>>,
) => {
  const search = query.q?.trim().toLowerCase();
  const tag = query.tag?.trim();
  const filtered = automations.filter((automation) => {
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
      (!query.targetDeviceId ||
        targetDeviceIdsByAutomation
          .get(automation.id)
          ?.has(query.targetDeviceId)) &&
      matchesLastRun(automation.lastRunAt, query.lastRun)
    );
  });
  return gridPage(
    sortAutomationGridItems(filtered, query.sort),
    automations,
    [...targetDeviceIdsByAutomation.values()].flatMap((ids) => [...ids]),
    query,
  );
};

export const buildAutomationTriggerGridPage = (
  triggers: AutomationTriggerDto[],
  query: ListAutomationTriggersGridQueryDto,
  automationNamesById: Map<string, string>,
) => {
  const search = query.q?.trim().toLowerCase();
  const tag = query.tag?.trim();
  const filtered = triggers.filter((trigger) => {
    const automationName = automationNamesById.get(trigger.automationId);
    return (
      (!search ||
        [
          trigger.name,
          trigger.description,
          trigger.targetDeviceId,
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
      (!query.targetDeviceId ||
        trigger.targetDeviceId === query.targetDeviceId) &&
      (!query.enabled || String(trigger.enabled) === query.enabled) &&
      (!query.status || trigger.lastStatus === query.status) &&
      matchesLastRun(trigger.lastRunAt, query.lastRun)
    );
  });
  return gridPage(
    sortAutomationTriggerGridItems(filtered, query.sort),
    triggers,
    triggers.map((trigger) => trigger.targetDeviceId),
    query,
  );
};

const sortAutomationGridItems = <T extends AutomationSummaryDto>(
  items: T[],
  sort?: string,
) =>
  sortGridItems(
    items,
    parseAutomationGridSort(sort, 'workflows'),
    (left, right, id) => {
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
    },
  );

const sortAutomationTriggerGridItems = (
  items: AutomationTriggerDto[],
  sort?: string,
) =>
  sortGridItems(
    items,
    parseAutomationGridSort(sort, 'triggers'),
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

const matchesLastRun = (
  lastRunAt: string | null,
  filter: ListAutomationsGridQueryDto['lastRun'],
) => {
  if (!filter || filter === 'all') return true;
  if (filter === 'never') return lastRunAt === null;
  if (!lastRunAt) return false;
  const days = { '7d': 7, '30d': 30, '90d': 90 }[filter];
  return (
    new Date(lastRunAt).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000
  );
};

const sortGridItems = <TItem extends { id: string }>(
  items: TItem[],
  sorting: ReturnType<typeof parseAutomationGridSort>,
  compare: (left: TItem, right: TItem, id: string) => number,
) => {
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
