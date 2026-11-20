import { ConflictException, Injectable } from '@nestjs/common';
import { ApkBlockRulesRepository } from '../persistence/apk-block-rules.repository';

export const isAndroidPackageName = (value: string | null): value is string =>
  value !== null &&
  /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(value);

const blocked = () =>
  new ConflictException({
    code: 'apk_blocked',
    message: 'This APK was blocked by an administrator.',
  });

@Injectable()
export class ApkBlockPolicyService {
  constructor(private readonly rules: ApkBlockRulesRepository) {}

  async assertFileAllowed(sha256: string) {
    if (await this.rules.exists('sha256', sha256)) throw blocked();
  }

  async assertAllowed(
    sha256: string,
    packageName: string | null,
    readPackage?: () => Promise<string | null>,
  ) {
    await this.assertFileAllowed(sha256);
    if (!isAndroidPackageName(packageName)) {
      if (!(await this.rules.hasPackageRules())) return;
      packageName = (await readPackage?.()) ?? null;
      if (!isAndroidPackageName(packageName)) {
        throw new ConflictException({
          code: 'apk_package_unavailable',
          message:
            'Rebroid could not verify the APK package name against the block rules.',
        });
      }
    }
    if (await this.rules.exists('package', packageName)) throw blocked();
  }
}
