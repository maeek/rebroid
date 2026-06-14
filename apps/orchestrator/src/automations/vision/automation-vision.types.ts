import type {
  VisionDetection,
  VisionObservation,
} from '@rebroid/vision-core/observation';
import type { OptimizedAiScreenshot } from '../ai/automation-ai-screenshot.utils';

export interface AutomationScreenObservation extends VisionObservation {
  aiImage?: OptimizedAiScreenshot;
}

export interface AutomationVisionLocateInput {
  query: string;
  threshold: number;
  maxResults: number;
  region?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface AutomationVisionLocateOutput {
  matches: VisionDetection[];
  query: string;
  threshold: number;
  reason?: string;
}
