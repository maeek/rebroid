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

it('checks visible Unicode labels and keeps raw hierarchy matching explicit', async () => {
  const [exists, missing] = new GenericAutomationCommandsService().list();
  const xml = `<hierarchy>
    <node text="Other" resource-id="Żappka" bounds="[0,0][20,20]" />
    <node visible-to-user="false" bounds="[0,0][20,20]">
      <node text="Żappka" bounds="[0,0][20,20]" />
    </node>
    <node enabled="false" content-desc="Z&#x307;appka code" bounds="[0,0][20,20]" />
  </hierarchy>`;
  const dumpUi = jest.fn().mockResolvedValue({ status: 'available', xml });
  const context = { adb: { dumpUi } } as never;

  await expect(
    missing.execute({ text: 'Żappka' }, context),
  ).resolves.toBeDefined();
  await expect(
    exists.execute({ text: 'Żappka', match: 'contains' }, context),
  ).resolves.toBeDefined();
  await expect(
    exists.execute(
      { text: 'resource-id="Żappka"', match: 'contains', source: 'xml' },
      context,
    ),
  ).resolves.toBeDefined();
});
