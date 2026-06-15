import { createAndroidDeviceControlAutomationCommands } from './android-device-control-automation-commands';

describe('android device control automation commands', () => {
  it.each([
    ['android.expandNotifications', 'expand-notifications'],
    ['android.expandQuickSettings', 'expand-settings'],
    ['android.collapsePanels', 'collapse-panels'],
  ])('wraps %s as a viewer control command', async (uses, viewerCommand) => {
    const viewerControl = jest.fn(async () => undefined);
    const command = createAndroidDeviceControlAutomationCommands().find(
      (item) => item.uses === uses,
    );

    await expect(
      command?.execute({}, {
        app: { id: 'app_1' },
        display: { viewerControl },
      } as never),
    ).resolves.toEqual({
      summary: expect.any(String),
    });
    expect(viewerControl).toHaveBeenCalledWith({ id: 'app_1' }, viewerCommand);
  });
});
