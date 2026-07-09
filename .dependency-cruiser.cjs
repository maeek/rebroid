const webFeatureDomains = [
  "applications",
  "automations",
  "orchestrator",
  "settings",
  "shell",
];
const noCrossWebFeatureImports = webFeatureDomains.flatMap((fromDomain) =>
  webFeatureDomains
    .filter((toDomain) => toDomain !== fromDomain)
    .map((toDomain) => ({
      name: `no-web-feature-${fromDomain}-to-${toDomain}`,
      severity: "error",
      from: { path: `^apps/web/src/features/${fromDomain}/` },
      to: { path: `^apps/web/src/features/${toDomain}/` },
    })),
);

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    ...noCrossWebFeatureImports,
    {
      name: "no-orchestrator-http-from-domain",
      severity: "error",
      from: {
        path: "^apps/orchestrator/src/(android-apps|apk)/.+/(services|utils)/",
      },
      to: { path: "/controllers/" },
    },
    {
      name: "orchestrator-docker-only-through-public-surface",
      severity: "error",
      from: { path: "^apps/orchestrator/src/(?!docker/)" },
      to: {
        path: "^apps/orchestrator/src/docker/(?!contracts/|docker\\.module\\.ts$|docker\\.types\\.ts$)",
      },
    },
    {
      name: "automations-android-only-through-public-surface",
      severity: "error",
      from: { path: "^apps/orchestrator/src/automations/" },
      to: {
        path: "^apps/orchestrator/src/android-apps/(?!contracts/|android-apps\\.module\\.ts$|common/services/android-apps-facade\\.service\\.ts$)",
      },
    },
    {
      name: "no-web-shared-ui-to-feature",
      severity: "error",
      from: { path: "^apps/web/src/shared/ui/" },
      to: { path: "^apps/web/src/features/" },
    },
    {
      name: "no-web-shared-ui-to-server",
      severity: "error",
      from: { path: "^apps/web/src/shared/ui/" },
      to: { path: "^apps/web/src/server/" },
    },
    {
      name: "generated-orchestrator-client-only-through-web-server",
      severity: "error",
      from: { path: "^apps/web/src/(?!server/orchestrator/)" },
      to: { path: "^packages/orchestrator-client/" },
    },
  ],
  options: {
    exclude: "(^|/)(node_modules|\\.next|dist)(/|$)",
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".mjs"] },
  },
};
