import { Injectable } from '@nestjs/common';
import { OcrSidecarService } from '../ocr-sidecar/ocr-sidecar.service';
import type { ServiceHealthDto } from './dto/health-response.dto';

@Injectable()
export class OcrSidecarHealthService {
  constructor(private readonly sidecar: OcrSidecarService) {}

  async health(): Promise<ServiceHealthDto> {
    const result = await this.sidecar.readiness();
    if (result.status === 'disabled') {
      return {
        ok: true,
        status: 'disabled',
        message: 'OCR sidecar integration is disabled.',
        details: { enabled: false },
      };
    }
    return {
      ok: result.status === 'healthy',
      status: result.status === 'unavailable' ? 'unhealthy' : result.status,
      message: result.message,
      details: {
        enabled: true,
        ...result.settings,
        ...('response' in result && result.response
          ? { response: result.response }
          : {}),
      },
    };
  }
}
