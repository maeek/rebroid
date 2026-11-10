type ProfileOption = number | string | null | undefined;

export function resolveDisplayStreamProfile(options: {
  maxSize?: ProfileOption;
  maxFps?: ProfileOption;
  bitrate?: ProfileOption;
}) {
  const maxSize = profileNumber(options.maxSize, 0);
  if (maxSize !== 0) {
    throw new Error(
      "Interactive display streaming requires native resolution (maxSize=0).",
    );
  }
  const maxFps = profileNumber(options.maxFps, 60);
  if (maxFps !== 60) {
    throw new Error("Interactive display streaming requires maxFps=60.");
  }
  return {
    maxSize,
    maxFps,
    bitrate: Math.min(
      Math.max(profileNumber(options.bitrate, 16_000_000), 100_000),
      100_000_000,
    ),
    iFrameInterval: 1,
  };
}

function profileNumber(value: ProfileOption, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}
