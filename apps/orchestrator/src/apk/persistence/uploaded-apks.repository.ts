import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { UploadedApk } from '../entities/uploaded-apk.entity';

@Injectable()
export class UploadedApksRepository {
  constructor(
    @InjectRepository(UploadedApk)
    private readonly uploadedApks: Repository<UploadedApk>,
  ) {}

  create(values: Partial<UploadedApk>) {
    return this.uploadedApks.create(values);
  }

  save(upload: UploadedApk) {
    return this.uploadedApks.save(upload);
  }

  remove(upload: UploadedApk) {
    return this.uploadedApks.remove(upload);
  }

  findById(id: string) {
    return this.uploadedApks.findOneBy({ id });
  }

  findBySha256ForOwner(sha256: string, ownerUserId?: string | null) {
    const owner = ownerUserId?.trim() || null;
    return this.uploadedApks.findOneBy({
      sha256,
      ownerUserId: owner ?? IsNull(),
    });
  }

  list(ownerUserId?: string | null) {
    const owner = ownerUserId?.trim();
    return this.uploadedApks.find({
      where: owner ? { ownerUserId: owner } : {},
      order: { createdAt: 'DESC' },
    });
  }

  listForCleanup(ownerUserId?: string | null) {
    const owner = ownerUserId?.trim();
    return this.uploadedApks.find({
      where: owner ? { ownerUserId: owner } : {},
    });
  }

  countSameShaExcluding(sha256: string, id: string) {
    return this.uploadedApks.countBy({ sha256, id: Not(id) });
  }

  countBySha256(sha256: string) {
    return this.uploadedApks.countBy({ sha256 });
  }

  async referencedFileNames() {
    const uploads = await this.uploadedApks.find({ select: { sha256: true } });
    return new Set(uploads.map((upload) => `${upload.sha256}.apk`));
  }

  findByIds(ids: string[]) {
    return this.uploadedApks.find({ where: { id: In(ids) } });
  }
}
