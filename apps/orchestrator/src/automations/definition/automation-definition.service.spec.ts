import { AndroidAutomationCommandsService } from '../commands/android-automation-commands.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { ContainerNetworkAutomationCommandsService } from '../commands/container-network-automation-commands.service';
import { GenericAutomationCommandsService } from '../commands/generic-automation-commands.service';
import { AutomationConditionService } from '../condition/automation-condition.service';
import { AutomationDefinitionService } from './automation-definition.service';

const createService = () => {
  const registry = new AutomationCommandRegistryService(
    new AndroidAutomationCommandsService(),
    new ContainerNetworkAutomationCommandsService(),
    new GenericAutomationCommandsService(),
  );
  registry.onModuleInit();
  const conditions = new AutomationConditionService();
  return {
    registry,
    service: new AutomationDefinitionService(registry, conditions),
  };
};

describe('AutomationDefinitionService', () => {
  it('normalizes YAML definitions and generates missing step IDs', () => {
    const { service } = createService();

    const definition = service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Wake and wait
spec:
  steps:
    - uses: android.viewerCommand
      with:
        command: wake
    - id: wait
      uses: android.wait
      with:
        durationMs: 1000
`);

    expect(definition.metadata.name).toBe('Wake and wait');
    expect(definition.spec.steps).toHaveLength(2);
    expect(definition.spec.steps[0]).toMatchObject({
      id: 'android-viewerCommand-1',
      uses: 'android.viewerCommand',
      with: { command: 'wake' },
    });
  });

  it('rejects unsupported commands', () => {
    const { service } = createService();

    expect(() =>
      service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Bad command
spec:
  steps:
    - uses: android.nope
      with: {}
`),
    ).toThrow('Unsupported automation command');
  });

  it('rejects malformed command inputs', () => {
    const { service } = createService();

    expect(() =>
      service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Bad input
spec:
  steps:
    - uses: container.network.allowCidr
      with:
        cidr: not-a-cidr
`),
    ).toThrow('Invalid input for container.network.allowCidr');
  });

  it('normalizes tags and nested flow blocks', () => {
    const { service } = createService();

    const definition = service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Branching
  tags:
    - Smoke
    - smoke
    - Login
spec:
  steps:
    - id: check-clipboard
      uses: android.getClipboard
      with: {}
    - id: branch
      type: condition
      condition:
        groups:
          - conditions:
              - value:
                  source: stepOutput
                  stepId: check-clipboard
                  outputKey: text
                operator: contains
                compare:
                  source: literal
                  value: ready
      then:
        - id: wait-ready
          uses: android.wait
          with:
            durationMs: 1000
      else:
        - id: stop-not-ready
          uses: flow.stop
          with:
            reason: Not ready
    - id: choose
      type: switch
      value:
        source: runContext
        key: targetProfileName
      cases:
        - value: default
          steps:
            - id: log-default
              uses: debug.log
              with:
                message: default profile
      default:
        - id: log-other
          uses: debug.log
          with:
            message: other profile
    - id: retry
      type: repeat
      count: 2
      maxIterations: 2
      steps:
        - id: retry-wait
          uses: android.wait
          with:
            durationMs: 500
`);

    expect(definition.metadata.tags).toEqual(['Smoke', 'Login']);
    expect(definition.spec.steps[1]).toMatchObject({
      id: 'branch',
      type: 'condition',
      then: [{ id: 'wait-ready' }],
      else: [{ id: 'stop-not-ready' }],
    });
    expect(definition.spec.steps[3]).toMatchObject({
      id: 'retry',
      type: 'repeat',
      count: 2,
      maxIterations: 2,
    });
  });

  it('rejects duplicate nested step IDs', () => {
    const { service } = createService();

    expect(() =>
      service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Duplicate nested ids
spec:
  steps:
    - id: branch
      type: condition
      condition:
        groups:
          - conditions:
              - value:
                  source: runContext
                  key: targetApplicationId
                operator: exists
      then:
        - id: duplicate
          uses: android.wait
          with:
            durationMs: 1000
    - id: duplicate
      uses: android.wait
      with:
        durationMs: 1000
`),
    ).toThrow('Duplicate step id "duplicate"');
  });

  it('requires repeat blocks to define bounded iteration', () => {
    const { service } = createService();

    expect(() =>
      service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Bad repeat
spec:
  steps:
    - id: repeat
      type: repeat
      steps:
        - id: wait
          uses: android.wait
          with:
            durationMs: 1000
`),
    ).toThrow('must define count or while');
  });

  it('exposes permission metadata for sensitive command families', () => {
    const { registry } = createService();
    const permissions = new Map(
      registry
        .listCommands()
        .map((command) => [command.uses, command.requiredPermissions]),
    );

    expect(permissions.get('android.adbShell')).toContain(
      'automations:run-adb-shell',
    );
    expect(permissions.get('container.network.allowCidr')).toContain(
      'automations:manage-network',
    );
  });

  it('exposes command-owned editor metadata derived from schemas', () => {
    const { registry } = createService();
    const commands = new Map(
      registry.listCommands().map((command) => [command.uses, command]),
    );

    expect(commands.get('android.swipe')?.editor).toMatchObject({
      inputDefaults: { durationMs: 300 },
      inputFieldOrder: ['x1', 'y1', 'x2', 'y2', 'durationMs'],
      yamlSnippetFields: ['x1', 'y1', 'x2', 'y2', 'durationMs'],
    });
    expect(commands.get('android.adbShell')?.editor).toMatchObject({
      inputDefaults: { timeoutMs: 15000 },
      inputFieldOrder: ['command', 'timeoutMs'],
      yamlSnippetFields: ['command', 'timeoutMs'],
    });
    expect(commands.get('android.getClipboard')?.editor).toMatchObject({
      inputDefaults: {},
      inputFieldOrder: [],
      yamlSnippetFields: [],
    });
  });
});
