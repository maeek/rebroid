import { Injectable } from '@nestjs/common';
import { sanitizeAiText } from './automation-ai-observation.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';

@Injectable()
export class AutomationAiRuntimeContextService {
  async buildForPlanner(context: AutomationAiHarnessContext) {
    const packageContext = await this.installedPackageContext(context);
    return [
      'Runtime context:',
      `- Rebroid app name: ${sanitizeAiText(context.app.name, 200)}`,
      context.app.apkPackageName
        ? `- Recorded uploaded APK package: ${context.app.apkPackageName}`
        : '- Recorded uploaded APK package: none',
      packageContext,
      '- Before launching an app by package, use the recorded package or a package listed here. If the needed package is missing, ask the user for it instead of guessing or installing it.',
      '- If more package detail is needed, call android.listPackages with a narrow query.',
    ].join('\n');
  }

  private async installedPackageContext(context: AutomationAiHarnessContext) {
    try {
      let result = await context.adb.shell(
        context.app,
        'pm list packages -3',
        5_000,
      );
      if (result.exitCode !== 0) {
        result = await context.adb.shell(
          context.app,
          'cmd package list packages -3',
          5_000,
        );
      }
      if (result.exitCode !== 0) {
        return `- Installed third-party packages: unavailable (${sanitizeAiText(result.stderr || result.stdout, 300)}).`;
      }
      const packages = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .map((line) => line.replace(/^package:/, ''))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));
      const visiblePackages = packages.slice(0, 25);
      const suffix =
        packages.length > visiblePackages.length
          ? `; ${packages.length - visiblePackages.length} more omitted`
          : '';
      return visiblePackages.length > 0
        ? `- Installed third-party packages (${visiblePackages.length}/${packages.length}): ${visiblePackages.join(', ')}${suffix}.`
        : '- Installed third-party packages: none reported.';
    } catch (error) {
      return `- Installed third-party packages: unavailable (${sanitizeAiText(error instanceof Error ? error.message : error, 300)}).`;
    }
  }
}
