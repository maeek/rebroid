import { ConflictException, Injectable } from '@nestjs/common';

@Injectable()
export class AndroidAppsPolicyGate {
  private readonly pending = new Set<string>();

  async run<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (this.pending.has(id)) {
      throw new ConflictException(
        'A network policy change is already in progress for this app.',
      );
    }
    this.pending.add(id);
    try {
      return await operation();
    } finally {
      this.pending.delete(id);
    }
  }
}
