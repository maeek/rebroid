import { DataSource } from 'typeorm';
import type { BetterSqlite3DataSourceOptions } from 'typeorm/driver/better-sqlite3/BetterSqlite3DataSourceOptions';
import { BetterSqlite3Driver } from 'typeorm/driver/better-sqlite3/BetterSqlite3Driver';
import { BetterSqlite3QueryRunner } from 'typeorm/driver/better-sqlite3/BetterSqlite3QueryRunner';
import type { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

class SqliteAdmission {
  private tail = Promise.resolve();
  private failure?: Error;

  async acquire() {
    const previous = this.tail;
    let resolve!: () => void;
    this.tail = new Promise<void>((release) => {
      resolve = release;
    });
    await previous;
    if (this.failure) {
      resolve();
      throw this.failure;
    }
    return resolve;
  }

  fail(error: unknown) {
    this.failure = new Error(
      'SQLite could not roll back an open transaction.',
      {
        cause: error,
      },
    );
  }
}

class SerializedSqliteQueryRunner extends BetterSqlite3QueryRunner {
  private releaseTransaction?: () => void;

  constructor(
    driver: BetterSqlite3Driver,
    private readonly admission: SqliteAdmission,
  ) {
    super(driver);
  }

  override async query(...args: Parameters<BetterSqlite3QueryRunner['query']>) {
    if (this.transactionDepth > 0 && !this.nativeTransactionActive()) {
      throw new Error('SQLite rolled back the current transaction.');
    }
    if (this.releaseTransaction) return super.query(...args);
    const release = await this.admission.acquire();
    try {
      return await super.query(...args);
    } finally {
      release();
    }
  }

  override async startTransaction(isolationLevel?: IsolationLevel) {
    this.releaseTransaction ??= await this.admission.acquire();
    try {
      await super.startTransaction(isolationLevel);
    } catch (error) {
      if (this.transactionDepth === 0) this.isTransactionActive = false;
      this.releaseIfFinished();
      throw error;
    }
  }

  override async commitTransaction() {
    try {
      await super.commitTransaction();
    } finally {
      this.releaseIfFinished();
    }
  }

  override async rollbackTransaction() {
    try {
      // SQLite can roll back the whole transaction on SQLITE_FULL or ROLLBACK conflicts.
      if (this.transactionDepth > 0 && !this.nativeTransactionActive()) {
        this.transactionDepth -= 1;
        this.isTransactionActive = this.transactionDepth > 0;
        return;
      }
      await super.rollbackTransaction();
    } finally {
      this.releaseIfFinished();
    }
  }

  override async release() {
    try {
      while (this.transactionDepth > 0) await this.rollbackTransaction();
    } catch (error) {
      this.admission.fail(error);
      this.releaseTransaction?.();
      this.releaseTransaction = undefined;
      throw error;
    } finally {
      await super.release();
    }
  }

  private releaseIfFinished() {
    if (this.transactionDepth !== 0) return;
    this.releaseTransaction?.();
    this.releaseTransaction = undefined;
  }

  private nativeTransactionActive() {
    const connection = this.driver.databaseConnection as {
      inTransaction: boolean;
    };
    return connection.inTransaction;
  }
}

export class SerializedSqliteDataSource extends DataSource {
  private readonly admission = new SqliteAdmission();

  constructor(options: BetterSqlite3DataSourceOptions) {
    super(options);
  }

  override createQueryRunner() {
    if (!(this.driver instanceof BetterSqlite3Driver)) {
      throw new Error('Serialized SQLite requires the better-sqlite3 driver.');
    }
    // TypeORM normally shares one runner. Each caller needs independent transaction state.
    const runner = new SerializedSqliteQueryRunner(this.driver, this.admission);
    Object.assign(runner, { manager: this.createEntityManager(runner) });
    return runner;
  }
}
