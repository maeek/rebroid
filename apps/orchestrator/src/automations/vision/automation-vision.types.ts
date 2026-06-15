import type {
  VisionDetection,
  VisionObservation,
} from '@rebroid/vision-core/observation';
import type { OptimizedAiScreenshot } from '../ai/automation-ai-screenshot.utils';

export interface AutomationScreenObservation extends VisionObservation {
  aiImage?: OptimizedAiScreenshot;
  screenState?: AutomationVisionScreenState;
}

export interface AutomationVisionScreenControl {
  label: string;
  role?: string;
  bounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  confidence?: number;
}

export interface AutomationVisionScreenState {
  screenKind:
    | 'home'
    | 'quick_settings'
    | 'notification_shade'
    | 'settings_app'
    | 'app_screen'
    | 'unknown';
  confidence: number;
  visibleText: string[];
  controls: AutomationVisionScreenControl[];
  evidence: string[];
  uncertainty: string[];
  summary: string;
  rawScreenKind?: AutomationVisionScreenState['screenKind'];
  rawSummary?: string;
  correctionReason?: string;
  settingsAccessVisible?: boolean;
}

export interface AutomationVisionContext {
  goal?: string;
  lastAction?: string;
  expectedOutcome?: string;
  confirmedFacts?: string[];
  latestHypothesis?: Pick<
    AutomationVisionScreenState,
    'screenKind' | 'confidence' | 'summary'
  >;
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
