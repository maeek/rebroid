import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AutomationAiProviderModelCapabilitiesDto,
  AutomationAiProviderModelDto,
} from './automation-ai-provider.dto';

export class AutomationAiProviderRemoteModelDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiPropertyOptional()
  family?: string;

  @ApiPropertyOptional()
  parameterSize?: string;

  @ApiPropertyOptional()
  quantizationLevel?: string;

  @ApiPropertyOptional({ type: AutomationAiProviderModelCapabilitiesDto })
  capabilities?: AutomationAiProviderModelCapabilitiesDto;
}

export class AutomationAiModelCatalogProviderDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: ['openai', 'openai-compatible', 'ollama'] })
  kind!: 'openai' | 'openai-compatible' | 'ollama';

  @ApiPropertyOptional({
    enum: ['openai-chat-completions', 'ollama-native-chat'],
  })
  protocol?: 'openai-chat-completions' | 'ollama-native-chat';

  @ApiPropertyOptional({
    enum: ['auto', 'openai', 'llama-cpp', 'lemonade', 'ollama'],
  })
  serverFlavor?: 'auto' | 'openai' | 'llama-cpp' | 'lemonade' | 'ollama';

  @ApiProperty({ type: AutomationAiProviderModelDto, isArray: true })
  models!: AutomationAiProviderModelDto[];
}

export class AutomationAiProviderHealthDto {
  @ApiProperty()
  providerId!: string;

  @ApiPropertyOptional()
  modelId?: string;

  @ApiProperty({ enum: ['ok', 'error', 'disabled'] })
  status!: 'ok' | 'error' | 'disabled';

  @ApiProperty()
  message!: string;

  @ApiProperty()
  checkedAt!: string;

  @ApiPropertyOptional({
    enum: ['auto', 'openai', 'llama-cpp', 'lemonade', 'ollama'],
  })
  serverFlavor?: string;
}
