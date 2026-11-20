import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ANDROID_APPS_APK_REFERENCES,
  type AndroidAppsApkReferencesPort,
} from '../../android-apps/contracts/android-apps-apk-references.port';
import type {
  ApkLibraryEntryDto,
  ApkLibraryMutationDto,
  ApkLibraryMutationResultDto,
} from '../dto/apk-library.dto';
import { UploadedApkResponseDto } from '../dto/uploaded-apk-response.dto';
import type { ApkBlockRule } from '../entities/apk-block-rule.entity';
import { ApkBlockRulesRepository } from '../persistence/apk-block-rules.repository';
import { UploadedApksRepository } from '../persistence/uploaded-apks.repository';
import { isAndroidPackageName } from './apk-block-policy.service';
import { ApkStorageService } from './apk-storage.service';

const ruleKey = (rule: Pick<ApkBlockRule, 'scope' | 'value'>) =>
  `${rule.scope}:${rule.value}`;
const groupBy = <T, K>(items: T[], getKey: (item: T) => K) => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
};

@Injectable()
export class ApkLibraryService {
  private readonly logger = new Logger(ApkLibraryService.name);

  constructor(
    private readonly uploads: UploadedApksRepository,
    private readonly rules: ApkBlockRulesRepository,
    private readonly storage: ApkStorageService,
    @Inject(ANDROID_APPS_APK_REFERENCES)
    private readonly references: AndroidAppsApkReferencesPort,
  ) {}

  async list() {
    const [uploads, rules, references] = await Promise.all([
      this.uploads.listForLibrary(),
      this.rules.list(),
      this.references.listUploadedApkReferences(),
    ]);
    const rulesByKey = new Map(rules.map((rule) => [ruleKey(rule), rule]));
    const appsByUpload = groupBy(references, (app) => app.uploadedApkId);
    const entries = [...groupBy(uploads, (upload) => upload.sha256)].map(
      ([sha256, records]) => {
        const upload = records[0];
        return {
          id: `sha256:${sha256}`,
          originalName: upload.originalName,
          displayName: upload.displayName,
          sha256,
          packageName:
            records.find((record) => record.packageName)?.packageName ?? null,
          sizeBytes: upload.sizeBytes,
          ownerUserIds: [
            ...new Set(
              records.flatMap((record) =>
                record.ownerUserId ? [record.ownerUserId] : [],
              ),
            ),
          ],
          uploads: records.length,
          apps: records.flatMap((record) =>
            (appsByUpload.get(record.id) ?? []).map(({ id, name }) => ({
              id,
              name,
            })),
          ),
          googlePlayServices: upload.googlePlayServicesVerdict,
          inspectionEvidence: UploadedApkResponseDto.parseEvidence(
            upload.googlePlayServicesEvidenceJson,
          ),
        };
      },
    );
    const represented = new Set<string>();
    const applyRules = (
      entry: Omit<ApkLibraryEntryDto, 'rules'>,
    ): ApkLibraryEntryDto => {
      const matches = [
        `sha256:${entry.sha256}`,
        `package:${entry.packageName}`,
      ].flatMap((key) => {
        const rule = rulesByKey.get(key);
        if (!rule) return [];
        represented.add(key);
        return [{ scope: rule.scope, value: rule.value, reason: rule.reason }];
      });
      return { ...entry, rules: matches };
    };
    const items = entries.map(applyRules);
    for (const rule of rules) {
      if (represented.has(ruleKey(rule))) continue;
      items.push(
        applyRules({
          id: ruleKey(rule),
          originalName: rule.originalName,
          displayName: null,
          sha256: rule.scope === 'sha256' ? rule.value : null,
          packageName: rule.packageName,
          sizeBytes: null,
          ownerUserIds: [],
          uploads: 0,
          apps: [],
          googlePlayServices: null,
          inspectionEvidence: [],
        }),
      );
    }
    return items;
  }

  mutate(input: ApkLibraryMutationDto) {
    if (input.action !== 'delete' && !input.scope) {
      throw new BadRequestException('Choose a block scope.');
    }
    if (input.action === 'block' && !input.reason?.trim()) {
      throw new BadRequestException('Enter a reason for blocking.');
    }
    return this.storage.withHash('apk-library-mutations', () =>
      this.applyMutation(input),
    );
  }

  private async applyMutation(input: ApkLibraryMutationDto) {
    const entries = new Map(
      (await this.list()).map((entry) => [entry.id, entry]),
    );
    const result: ApkLibraryMutationResultDto = {
      changed: [],
      skipped: [],
      bytesFreed: 0,
    };
    const applied = new Map<string, string | null>();
    for (const id of new Set(input.ids)) {
      const entry = entries.get(id);
      if (!entry) {
        result.skipped.push({ id, reason: 'APK is no longer in the library.' });
        continue;
      }
      try {
        const key =
          input.scope === 'package' ? entry.packageName : entry.sha256;
        const reason = await this.mutateEntry(
          input,
          entry,
          key,
          applied,
          result,
        );
        if (reason) result.skipped.push({ id, reason });
        else result.changed.push(id);
      } catch (error) {
        this.logger.warn('APK library mutation failed', {
          id,
          action: input.action,
          error,
        });
        result.skipped.push({
          id,
          reason: 'The operation could not be completed. Try again.',
        });
      }
    }
    return result;
  }

  private async mutateEntry(
    input: ApkLibraryMutationDto,
    entry: ApkLibraryEntryDto,
    value: string | null,
    applied: Map<string, string | null>,
    result: ApkLibraryMutationResultDto,
  ) {
    if (input.action === 'delete') {
      if (!entry.sha256 || entry.sizeBytes === null)
        return 'File already removed.';
      if (entry.apps.length) return 'An app still uses this APK.';
      const deletion = await this.deleteFile(entry.sha256);
      result.bytesFreed += deletion.bytesFreed;
      return deletion.reason;
    }
    const scope = input.scope;
    if (
      !scope ||
      !value ||
      (scope === 'package' && !isAndroidPackageName(value))
    ) {
      return 'The selected APK has no value for this scope.';
    }
    if (applied.has(value)) return applied.get(value) ?? null;
    let reason = null;
    if (input.action === 'unblock') {
      if (!(await this.rules.remove(scope, value)))
        reason = 'No block rule of this scope exists.';
    } else if (await this.rules.exists(scope, value)) {
      reason = 'A block rule of this scope already exists.';
    } else {
      await this.rules.add({
        scope,
        value,
        reason: input.reason?.trim() ?? '',
        originalName: entry.originalName,
        packageName: entry.packageName,
      });
    }
    applied.set(value, reason);
    return reason;
  }

  private deleteFile(sha256: string) {
    return this.storage.withHash(sha256, async () => {
      const uploads = await this.uploads.findBySha256(sha256);
      if (!uploads.length)
        return { reason: 'File already removed.', bytesFreed: 0 };
      const inUse = await this.references.findReferencedUploadedApkIds(
        uploads.map((upload) => upload.id),
      );
      if (inUse.size)
        return { reason: 'An app still uses this APK.', bytesFreed: 0 };
      const deleted = await this.storage.deleteSharedFile(sha256);
      await this.uploads.removeBySha256(sha256);
      return { reason: null, bytesFreed: deleted ? uploads[0].sizeBytes : 0 };
    });
  }
}
