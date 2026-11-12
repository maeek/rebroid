import { GenericAutomationCommandsService } from './generic-automation-commands.service';

it('requires a usable UI hierarchy to assert that text is missing', async () => {
  const command = new GenericAutomationCommandsService()
    .list()
    .find(({ uses }) => uses === 'assert.textMissing')!;
  const app = { id: 'app-1' };
  const { signal } = new AbortController();
  const dumpUi = jest
    .fn()
    .mockResolvedValueOnce({ status: 'failed' })
    .mockResolvedValueOnce({ status: 'available', xml: '<hierarchy/>' });
  const context = { app, adb: { dumpUi }, abortSignal: signal } as never;
  const input = { text: 'Żappka' };
  await expect(command.execute(input, context)).rejects.toThrow(
    'Android UI hierarchy is unavailable.',
  );
  await expect(command.execute(input, context)).resolves.toEqual({
    summary: 'Text "Żappka" is missing.',
  });
  expect(dumpUi).toHaveBeenCalledWith(app, signal);
});
