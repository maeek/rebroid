import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";

export const displayFeatureKeys = [
  "feature.display-virtual",
  "feature.display-webrtc",
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

  apply(snapshot: SidecarFeatureSnapshot) {
    if (!Number.isSafeInteger(snapshot?.revision) || snapshot.revision < 0) {
      throw new BadRequestException(
        "Feature revision must be a non-negative integer.",
      );
    }
    const features = snapshot.features;
    if (
      !Array.isArray(features) ||
      features.length !== displayFeatureKeys.length ||
      !displayFeatureKeys.every((key) =>
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
    return this.state();
  }

  state(): SidecarFeatureSnapshot {
    return {
      revision: this.revision,
      features: displayFeatureKeys.map((key) => ({
        key,
        effective: this.enabled.has(key),
      })),
    };
  }

  assertVirtualDisplayEnabled() {
    this.assertEnabled("feature.display-virtual", "Virtual displays");
  }

  isWebrtcEnabled() {
    return this.enabled.has("feature.display-webrtc");
  }

  assertWebrtcEnabled() {
    this.assertEnabled("feature.display-webrtc", "WebRTC streaming");
  }

  private assertEnabled(key: DisplayFeatureKey, label: string) {
    if (this.enabled.has(key)) return;
    throw new ConflictException({
      statusCode: 409,
      code: "feature_disabled",
      feature: key,
      message: `${label} is disabled or feature state is not synchronized.`,
    });
  }
}
