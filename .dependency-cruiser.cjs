const webFeatureDomains = [
  "applications",
  "auth",
  "automations",
  "platform",
  "scheduled-tasks",
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
      to: { circular: true, dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-unresolved-imports",
      severity: "error",
      from: {},
      to: { couldNotResolve: true, path: "^@/" },
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
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "automations-android-only-through-public-surface",
      severity: "error",
      from: { path: "^apps/orchestrator/src/automations/" },
      to: {
        path: "^apps/orchestrator/src/android-apps/(?!contracts/|android-apps\\.module\\.ts$)",
        dependencyTypesNot: ["type-only"],
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
      name: "no-web-shared-model-to-server",
      severity: "error",
      from: { path: "^apps/web/src/shared/model/" },
      to: { path: "^apps/web/src/server/" },
    },
    {
      name: "no-web-server-to-ui",
      severity: "error",
      from: { path: "^apps/web/src/server/" },
      to: { path: "^apps/web/src/(components|features|shared/ui)/" },
    },
    {
      name: "generated-orchestrator-client-only-through-web-server",
      severity: "error",
      from: { path: "^apps/web/src/(?!server/orchestrator/|shared/contracts/)" },
      to: { path: "^packages/orchestrator-client/" },
    },
  ],
  options: {
    tsConfig: { fileName: ".dependency-cruiser.tsconfig.json" },
    exclude: "(^|/)(node_modules|\\.next|dist)(/|$)",
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".mjs"] },
  },
};
