import { AndroidAutomationCommandsService } from '../commands/android-automation-commands.service';
import { AiAutomationCommandsService } from '../commands/ai-automation-commands.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { ContainerNetworkAutomationCommandsService } from '../commands/container-network-automation-commands.service';
import { GenericAutomationCommandsService } from '../commands/generic-automation-commands.service';
import { AutomationConditionService } from '../condition/automation-condition.service';
import { AutomationDefinitionNormalizerService } from './automation-definition-normalizer.service';
import { AutomationDefinitionService } from './automation-definition.service';

const createService = () => {
  const registry = new AutomationCommandRegistryService(
    new AndroidAutomationCommandsService(),
    new ContainerNetworkAutomationCommandsService(),
    new GenericAutomationCommandsService(),
    new AiAutomationCommandsService(),
  );
  registry.onModuleInit();
  const conditions = new AutomationConditionService();
  const normalizer = new AutomationDefinitionNormalizerService(
    registry,
    conditions,
  );
  return {
    registry,
    service: new AutomationDefinitionService(normalizer),
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

  it.each([
    'container.network.blockCidr',
    'container.network.removeBlockedCidr',
    'container.network.clearBlockedCidrs',
  ])(
    'omits the unimplemented %s from the registry and workflow definitions',
    (uses) => {
      const { registry, service } = createService();
      expect(
        registry.listCommands().map((command) => command.uses),
      ).not.toContain(uses);
      expect(() =>
        service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Unavailable command
spec:
  steps:
    - uses: ${uses}
`),
      ).toThrow('Unsupported automation command');
    },
  );

  it.each(['flow.stop', 'android.tapText', 'android.adbShell'])(
    'rejects %s as a grant on an AI workflow step',
    (uses) => {
      const { service } = createService();
      expect(() =>
        service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: AI capability check
spec:
  steps:
    - uses: ai.run
      with:
        prompt: Inspect the screen
        capabilities: [${uses}]
`),
      ).toThrow('Command is unavailable to the device agent.');
    },
  );

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

  it.each([
    'Inspect the screen',
    '{ $ref: { source: stepOutput, stepId: note, outputKey: summary } }',
  ])(
    'reports unrecognized AI settings instead of dropping them from %s',
    (prompt) => {
      const { service } = createService();
      expect(() =>
        service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata: { name: AI settings }
spec:
  steps:
    - id: note
      uses: debug.log
      with: { message: Inspect the screen }
    - uses: ai.run
      with:
        prompt: ${prompt}
        rawShellPolciy: allowlisted
`),
      ).toThrow('rawShellPolciy');
    },
  );

  it('accepts type-compatible earlier outputs and rejects wrong types or authorization inputs', () => {
    const { service } = createService();
    const yaml = `
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Copy a file
spec:
  steps:
    - id: source
      uses: android.pullFile
      with:
        path: /sdcard/source.txt
    - id: copy
      uses: android.pushFile
      with:
        path: /sdcard/copy.txt
        contentBase64:
          $ref: { source: stepOutput, stepId: source, outputKey: contentBase64 }
`;
    expect(service.parseYaml(yaml).spec.steps[1]).toMatchObject({
      with: {
        path: '/sdcard/copy.txt',
        contentBase64: {
          $ref: {
            source: 'stepOutput',
            stepId: 'source',
            outputKey: 'contentBase64',
          },
        },
      },
    });
    expect(() =>
      service.parseYaml(
        yaml.replace('outputKey: contentBase64', 'outputKey: sizeBytes'),
      ),
    ).toThrow('needs a string output');
    expect(() =>
      service.parseYaml(yaml.replace('stepId: source', 'stepId: copy')),
    ).toThrow('must reference an earlier step');
    expect(() =>
      service.parseYaml(
        yaml
          .replace('android.pushFile', 'ai.run')
          .replace('path: /sdcard/copy.txt', 'prompt: Inspect')
          .replace('contentBase64:\n', 'rawShellPolicy:\n'),
      ),
    ).toThrow('does not accept a step output');
  });

  it('publishes the outputs actually returned by Pull file', async () => {
    const { registry } = createService();
    const path = '/sdcard/source.txt';
    const data = { path, contentBase64: 'YQ==', sizeBytes: 1 };
    await expect(
      registry.execute('android.pullFile', { path }, {
        adb: { pullFile: jest.fn().mockResolvedValue(data) },
      } as never),
    ).resolves.toMatchObject({ data });
    expect(
      registry.outputsFor('android.pullFile').map(({ key }) => key),
    ).toEqual([
      'summary',
      'commandOutcome',
      'contentBase64',
      'path',
      'sizeBytes',
    ]);
    const pushFile = jest.fn().mockResolvedValue({ pushed: true });
    await registry.execute('android.pushFile', { path, contentBase64: '' }, {
      app: {},
      adb: { pushFile },
    } as never);
    expect(pushFile).toHaveBeenCalledWith({}, path, '', undefined);
  });

  it('rejects outputs from a sibling branch for command inputs', () => {
    const { service } = createService();
    expect(() =>
      service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata: { name: Branch scope }
spec:
  steps:
    - id: choose
      type: condition
      condition:
        groups:
          - conditions:
              - value: { source: literal, value: true }
                operator: isTrue
      then:
        - id: source
          uses: debug.log
          with: { message: yes }
      else:
        - id: copy
          uses: debug.log
          with:
            message:
              $ref: { source: stepOutput, stepId: source, outputKey: summary }
`),
    ).toThrow('must reference an earlier step');
  });

  it('normalizes tags and nested flow blocks', () => {
    const { service } = createService();

    const definition = service.parseYaml(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Branching
  tags:
    - name: Smoke
      color: '#0ea5e9'
    - name: smoke
      color: '#22c55e'
    - name: Login
      color: '#f97316'
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

    expect(definition.metadata.tags).toEqual([
      { name: 'Smoke', color: '#0ea5e9' },
      { name: 'Login', color: '#f97316' },
    ]);
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
    expect(
      commands.get('android.expandQuickSettings')?.inputSchema,
    ).toMatchObject({
      type: 'object',
    });
    expect(
      commands.get('android.expandQuickSettings')?.inputSchema.required,
    ).toBeUndefined();
    expect(
      commands.get('android.expandNotifications')?.inputSchema,
    ).toMatchObject({
      type: 'object',
    });
    expect(
      commands.get('android.expandNotifications')?.inputSchema.required,
    ).toBeUndefined();
    expect(commands.get('android.swipe')?.inputSchema.required).toEqual([
      'x1',
      'y1',
      'x2',
      'y2',
    ]);
    expect(commands.get('android.listPackages')?.inputSchema.required).toEqual(
      [],
    );
    expect(commands.get('ai.run')?.inputSchema.required).toEqual(['prompt']);
  });
});
