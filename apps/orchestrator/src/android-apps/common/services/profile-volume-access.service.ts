import { ConflictException, Injectable } from '@nestjs/common';

@Injectable()
export class ProfileVolumeAccess {
  private readonly uploads = new Map<string, number>();
  private readonly removals = new Set<string>();

  async withUpload<T>(
    volumeName: string,
    upload: () => Promise<T>,
  ): Promise<T> {
    if (this.removals.has(volumeName)) {
      throw new ConflictException('This profile volume is being deleted.');
    }
    this.uploads.set(volumeName, (this.uploads.get(volumeName) ?? 0) + 1);
    try {
      return await upload();
    } finally {
      const remaining = this.uploads.get(volumeName)! - 1;
      if (remaining) this.uploads.set(volumeName, remaining);
      else this.uploads.delete(volumeName);
    }
  }

  async withRemoval<T>(
    volumeName: string,
    remove: () => Promise<T>,
  ): Promise<T> {
    if (this.uploads.has(volumeName) || this.removals.has(volumeName)) {
      throw new ConflictException(
        'This profile volume is in use. Retry after the current operation finishes.',
      );
    }
    this.removals.add(volumeName);
    try {
      return await remove();
    } finally {
      this.removals.delete(volumeName);
    }
  }
}
