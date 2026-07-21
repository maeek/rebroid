import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";

export const DISPLAY_FEATURE_KEY = "feature.display-virtual" as const;

export interface SidecarFeatureSnapshot {
  revision: number;
  features: Array<{ key: typeof DISPLAY_FEATURE_KEY; effective: boolean }>;
}

@Injectable()
export class SidecarFeatureService {
  private revision = -1;
  private displayVirtual = false;

  apply(snapshot: SidecarFeatureSnapshot) {
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) {
      throw new BadRequestException(
        "Feature revision must be a non-negative integer.",
      );
    }
    if (
      snapshot.features.length !== 1 ||
      snapshot.features[0]?.key !== DISPLAY_FEATURE_KEY ||
      typeof snapshot.features[0].effective !== "boolean"
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

    this.revision = snapshot.revision;
    this.displayVirtual = snapshot.features[0].effective;
    return this.state();
  }

  state() {
    return {
      revision: this.revision,
      features: [{ key: DISPLAY_FEATURE_KEY, effective: this.displayVirtual }],
    };
  }

  assertVirtualDisplayEnabled() {
    if (this.revision >= 0 && this.displayVirtual) return;
    throw new ConflictException({
      statusCode: 409,
      code: "feature_disabled",
      feature: DISPLAY_FEATURE_KEY,
      message:
        "Virtual displays are disabled or feature state is not synchronized.",
    });
  }
}
