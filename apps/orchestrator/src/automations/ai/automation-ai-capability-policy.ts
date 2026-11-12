import {
  isDefaultAiCapability,
  isRoutedAiCapability,
  isSelectableAiCapability,
  type RoutedAiCapability,
} from '@rebroid/automation-core/ai-run';
import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import type { AutomationCommandDto } from '../dto/automation-command.dto';

export type RoutedAiCapabilities = readonly AutomationCommandDto[];

const appNavigation = [
  'open',
  'launch',
  'start',
  'app',
  'apps',
  'drawer',
  'launcher',
  'otworz',
  'uruchom',
  'aplikacja',
  'aplikacje',
  'aplikacji',
];
const fileTerms = [
  'file',
  'files',
  'folder',
  'directory',
  'sdcard',
  'download',
  'downloads',
  'plik',
  'pliki',
];
const networkTerms = [
  'network',
  'firewall',
  'cidr',
  'allowlist',
  'restrictions',
  'internet',
];
const clipboardTerms = ['clipboard', 'schowek', 'schowka'];
const discoveryTools = new Set<string>([
  'vision.locate',
  'android.listPackages',
  'vision.observe',
]);

const routingHints: Record<
  RoutedAiCapability,
  {
    terms: readonly string[];
    context?: readonly string[];
  }
> = {
  'vision.locate': {
    terms: [
      ...appNavigation,
      'find',
      'locate',
      'tap',
      'click',
      'label',
      'text',
      'ocr',
      'znajdz',
      'kliknij',
      'tekst',
    ],
  },
  'vision.observe': {
    terms: ['screen', 'observe', 'inspect', 'visible', 'ocr', 'ekran'],
  },
  'android.listPackages': {
    terms: [
      ...appNavigation,
      'package',
      'packages',
      'installed',
      'pakiet',
      'pakiety',
    ],
  },
  'android.getSetting': {
    terms: [
      'setting',
      'settings',
      'preference',
      'preferences',
      'ustawienie',
      'ustawienia',
    ],
  },
  'android.getClipboard': { terms: clipboardTerms },
  'android.setClipboard': {
    terms: ['set', 'write', 'copy', 'replace', 'clear', 'zapisz'],
    context: clipboardTerms,
  },
  'android.collapsePanels': {
    terms: ['collapse', 'dismiss', 'close', 'hide'],
    context: ['panel', 'panels', 'notifications', 'shade'],
  },
  'android.rotateDisplay': {
    terms: [
      'rotate',
      'rotation',
      'orientation',
      'portrait',
      'landscape',
      'obroc',
    ],
  },
  'android.fileExists': {
    terms: ['find', 'check', 'exists', 'verify', 'present'],
    context: fileTerms,
  },
  'android.listFiles': {
    terms: ['list', 'show', 'browse', 'enumerate', 'contents'],
    context: fileTerms,
  },
  'android.pullFile': {
    terms: ['pull', 'read', 'export', 'download', 'retrieve'],
    context: fileTerms,
  },
  'android.pushFile': {
    terms: ['push', 'write', 'upload', 'save', 'import'],
    context: fileTerms,
  },
  'android.deleteFile': {
    terms: ['delete', 'remove', 'erase', 'unlink', 'usun'],
    context: fileTerms,
  },
  'container.network.allowCidr': {
    terms: ['allow', 'add', 'permit'],
    context: networkTerms,
  },
  'container.network.removeAllowedCidr': {
    terms: ['remove', 'revoke', 'delete'],
    context: networkTerms,
  },
  'container.network.clearAllowedCidrs': {
    terms: ['clear', 'empty'],
    context: networkTerms,
  },
  'container.network.setRestrictions': {
    terms: ['set', 'enable', 'disable', 'restrict', 'unrestrict'],
    context: networkTerms,
  },
  'container.network.resetPolicy': {
    terms: ['reset', 'restore'],
    context: networkTerms,
  },
};

export const routeCapabilities = ({
  commands,
  goal,
  input,
}: {
  commands: readonly AutomationCommandDto[];
  goal: string;
  input: Pick<AutomationAiRunInput, 'capabilities'>;
}): RoutedAiCapabilities => {
  const terms = new Set(
    goal
      .normalize('NFD')
      .toLowerCase()
      .replace(/\p{M}/gu, '')
      .match(/[\p{L}\p{N}]+/gu),
  );
  if (/(?:^|[\s"'(])\/[\p{L}\p{N}._-]/u.test(goal)) terms.add('file');
  const ranked = commands.flatMap((command) => {
    const { uses } = command;
    if (!isRoutedAiCapability(uses)) return [];
    return [{ command, score: scoreCapability(uses, terms) }];
  });
  const allowed = ranked.filter(({ command }) =>
    commandAllowedForRun(input, command.uses),
  );
  const relevant = allowed.filter(({ score }) => score > 0);
  if (relevant.length > 0) {
    return relevant
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.command.uses.localeCompare(right.command.uses),
      )
      .slice(0, 5)
      .map(({ command }) => command);
  }
  const defaults = allowed
    .map(({ command }) => command)
    .filter(({ uses }) => isDefaultAiCapability(uses));
  const optional = allowed
    .map(({ command }) => command)
    .filter(({ uses }) => !isDefaultAiCapability(uses));
  if (optional.length && !ranked.some(({ score }) => score > 0)) {
    return [...optional, ...defaults].slice(0, 5);
  }
  const discovery = defaults.filter(({ uses }) => discoveryTools.has(uses));
  if (discovery.length > 0) return discovery;
  return defaults.slice(0, 5);
};

export const capabilityPrompt = (capabilities: RoutedAiCapabilities) => {
  if (capabilities.length === 0) return 'Available capabilities: none.';
  return [
    'Available typed capabilities for invoke_capability:',
    ...capabilities.map(
      (capability) =>
        `- ${capability.uses}: ${capability.description}; input=${JSON.stringify(capability.inputSchema)}`,
    ),
  ].join('\n');
};

export const commandAllowedForRun = (
  input: Pick<AutomationAiRunInput, 'capabilities'>,
  uses: string,
) =>
  isSelectableAiCapability(uses) &&
  (input.capabilities?.includes(uses) ?? isDefaultAiCapability(uses));

export const validatedEscalationCommand = (program: string, args: string[]) => {
  const safeToken = /^[a-zA-Z0-9._:/=-]+$/;
  if (!safeToken.test(program) || args.some((arg) => !safeToken.test(arg))) {
    return null;
  }
  if (program === 'settings' && args[0] === 'get' && args.length === 3) {
    return [program, ...args].join(' ');
  }
  if (program === 'getprop' && args.length <= 1) {
    return [program, ...args].join(' ');
  }
  if (program === 'dumpsys' && args.length === 1) {
    return [program, ...args].join(' ');
  }
  return null;
};

const scoreCapability = (
  uses: RoutedAiCapability,
  goalTerms: ReadonlySet<string>,
) => {
  const { terms, context } = routingHints[uses];
  if (context && !context.some((term) => goalTerms.has(term))) return 0;
  return terms.filter((term) => goalTerms.has(term)).length;
};
