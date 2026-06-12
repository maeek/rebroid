import { BadRequestException, Injectable } from '@nestjs/common';
import { parse, stringify } from 'yaml';
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import { AutomationDefinitionNormalizerService } from './automation-definition-normalizer.service';

@Injectable()
export class AutomationDefinitionService {
  constructor(
    private readonly normalizer: AutomationDefinitionNormalizerService,
  ) {}

  parseYaml(yaml: string) {
    let parsed: unknown;
    try {
      parsed = parse(yaml);
    } catch (error) {
      throw new BadRequestException(
        `Automation YAML is invalid: ${error instanceof Error ? error.message : 'parse error'}`,
      );
    }

    return this.normalize(parsed);
  }

  normalize(raw: unknown): AutomationDefinition {
    return this.normalizer.normalize(raw);
  }

  toYaml(definition: AutomationDefinition) {
    return stringify(definition, { indent: 2 });
  }

  validateYaml(yaml: string) {
    try {
      const definition = this.parseYaml(yaml);
      return {
        valid: true,
        definition,
        yaml: this.toYaml(definition),
        errors: [],
      };
    } catch (error) {
      return {
        valid: false,
        definition: null,
        yaml: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }
}
