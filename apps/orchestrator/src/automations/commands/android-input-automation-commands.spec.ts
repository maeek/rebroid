import sharp from 'sharp';
import { createAndroidInputAutomationCommands } from './android-input-automation-commands';
import type { AutomationCommandContext } from './automation-command.types';

describe('normalized Android input commands', () => {
  const swipeInput = {
    start: { x: 0.5, y: 0.9 },
    end: { x: 0.5, y: 0.15 },
    durationMs: 500,
  };
  const commands = createAndroidInputAutomationCommands();
  const app = { id: 'app-1' };
  const screenshot = jest.fn();
  const tap = jest.fn();
  const swipe = jest.fn();
  const context = {
    app,
    adb: { screenshot, tap, swipe },
  } as unknown as AutomationCommandContext;

  beforeEach(() => jest.resetAllMocks());

  it.each([
    ['android.tapNormalized', { x: 0.5, y: 0.5 }],
    ['android.swipeNormalized', swipeInput],
  ])(
    'rejects %s before dispatch when the screenshot cannot be decoded',
    async (uses, input) => {
      screenshot.mockResolvedValue({
        dataUrl: 'data:image/png;base64,aW52YWxpZA==',
      });
      const command = commands.find((command) => command.uses === uses)!;

      await expect(command.execute(input, context)).rejects.toThrow(
        'Could not determine Android display dimensions from the screenshot.',
      );
      expect(tap).not.toHaveBeenCalled();
      expect(swipe).not.toHaveBeenCalled();
    },
  );

  it('uses the screenshot dimensions for the app drawer swipe', async () => {
    const png = await sharp({
      create: { width: 100, height: 200, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
    screenshot.mockResolvedValue({
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    });
    const command = commands.find(
      (command) => command.uses === 'android.swipeNormalized',
    )!;

    await command.execute(swipeInput, context);

    expect(swipe).toHaveBeenCalledWith(
      app,
      { x1: 50, y1: 179, x2: 50, y2: 30, durationMs: 500 },
      undefined,
    );
  });
});
