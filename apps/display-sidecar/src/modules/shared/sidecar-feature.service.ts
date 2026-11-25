import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { SidecarConfigService } from "./sidecar-config.service";

export const displayFeatureKeys = [
  "feature.display-virtual",
  "feature.display-webrtc",
  "feature.external-devices",
] as const;

type DisplayFeatureKey = (typeof displayFeatureKeys)[number];

export interface SidecarFeatureSnapshot {
  revision: number;
  features: Array<{ key: DisplayFeatureKey; effective: boolean }>;
}

@Injectable()
export class SidecarFeatureService {
  private revision = -1;
  private enabled = new Set<DisplayFeatureKey>();
  private observedAt = 0;

  constructor(@Optional() private readonly config?: SidecarConfigService) {}

  private keys() {
    return this.config?.externalAdbEnabled
      ? displayFeatureKeys
      : displayFeatureKeys.filter((key) => key !== "feature.external-devices");
  }

  apply(snapshot: SidecarFeatureSnapshot) {
    if (!Number.isSafeInteger(snapshot?.revision) || snapshot.revision < 0) {
      throw new BadRequestException(
        "Feature revision must be a non-negative integer.",
      );
    }
    const features = snapshot.features;
    const keys = this.keys();
    if (
      !Array.isArray(features) ||
      features.length !== keys.length ||
      !keys.every((key) =>
        features.some(
          (feature) =>
            feature?.key === key && typeof feature.effective === "boolean",
        ),
      )
    ) {
      throw new BadRequestException("The display feature snapshot is invalid.");
    }
    if (snapshot.revision < this.revision) {
      throw new ConflictException({
        statusCode: 409,
        code: "feature_revision_stale",
        message: "The display feature snapshot revision is stale.",
      });
    }

    this.enabled = new Set(
      features.filter(({ effective }) => effective).map(({ key }) => key),
    );
    this.revision = snapshot.revision;
    this.observedAt = Date.now();
    return this.state();
  }

  state(): SidecarFeatureSnapshot {
    return {
      revision: this.revision,
      features: this.keys().map((key) => ({
        key,
        effective: this.isEnabled(key),
      })),
    };
  }

  assertVirtualDisplayEnabled() {
    this.assertEnabled("feature.display-virtual", "Virtual displays");
  }

  isWebrtcEnabled() {
    return this.isEnabled("feature.display-webrtc");
  }

  isExternalAdbEnabled() {
    return Boolean(
      this.config?.externalAdbEnabled &&
      this.isEnabled("feature.external-devices"),
    );
  }

  assertWebrtcEnabled() {
    this.assertEnabled("feature.display-webrtc", "WebRTC streaming");
  }

  private assertEnabled(key: DisplayFeatureKey, label: string) {
    if (this.isEnabled(key)) return;
    throw new ConflictException({
      statusCode: 409,
      code: "feature_disabled",
      feature: key,
      message: `${label} is disabled or feature state is not synchronized.`,
    });
  }

  private isEnabled(key: DisplayFeatureKey) {
    return (
      this.enabled.has(key) &&
      (!this.config?.externalAdbEnabled ||
        Date.now() - this.observedAt < 30_000)
    );
  }
}
