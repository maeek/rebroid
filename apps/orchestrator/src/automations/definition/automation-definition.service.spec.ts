import { AndroidAutomationCommandsService } from '../commands/android-automation-commands.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { ContainerNetworkAutomationCommandsService } from '../commands/container-network-automation-commands.service';
import { GenericAutomationCommandsService } from '../commands/generic-automation-commands.service';
import { AutomationDefinitionService } from './automation-definition.service';

const createService = () => {
  const registry = new AutomationCommandRegistryService(
    new AndroidAutomationCommandsService(),
    new ContainerNetworkAutomationCommandsService(),
    new GenericAutomationCommandsService(),
  );
  registry.onModuleInit();
  return {
    registry,
    service: new AutomationDefinitionService(registry),
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
});
