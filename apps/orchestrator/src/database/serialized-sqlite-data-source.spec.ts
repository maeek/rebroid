import { SerializedSqliteDataSource } from './serialized-sqlite-data-source';

it('keeps the connection usable when SQLite automatically rolls back a full transaction', async () => {
  const db = await new SerializedSqliteDataSource({
    type: 'better-sqlite3',
    database: ':memory:',
  }).initialize();
  try {
    await db.query('CREATE TABLE fixture (value BLOB)');
    await db.query('PRAGMA max_page_count = 3');
    await expect(
      db.transaction((manager) =>
        manager.query('INSERT INTO fixture VALUES (zeroblob(1000000))'),
      ),
    ).rejects.toMatchObject({ code: 'SQLITE_FULL' });
    await db.query('INSERT INTO fixture VALUES (zeroblob(1))');
    await expect(
      db.query('SELECT COUNT(*) AS count FROM fixture'),
    ).resolves.toEqual([{ count: 1 }]);
  } finally {
    await db.destroy();
  }
});
