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

const orchestratorDomains = [
  "android-apps",
  "apk",
  "automations",
  "container-images",
  "docker",
  "docker-maintenance",
  "health",
  "metrics",
  "network-isolation",
  "network-policy",
  "scheduled-tasks",
  "settings",
  "system-resources",
];
const noCrossOrchestratorPersistenceImports = orchestratorDomains.flatMap(
  (fromDomain) =>
    orchestratorDomains
      .filter((toDomain) => toDomain !== fromDomain)
      .map((toDomain) => ({
        name: `no-orchestrator-${fromDomain}-to-${toDomain}-persistence`,
        severity: "error",
        from: { path: `^apps/orchestrator/src/${fromDomain}/` },
        to: {
          path: `^apps/orchestrator/src/${toDomain}/(?:persistence/(?![^/]+\\.module\\.ts$)|entities/|[^/]+\\.entity\\.ts$|.+/entities/)`,
        },
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
    {
      name: "packages-do-not-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    ...noCrossWebFeatureImports,
    ...noCrossOrchestratorPersistenceImports,
    {
      name: "orchestrator-ports-do-not-import-adapters",
      severity: "error",
      from: {
        path: "^apps/orchestrator/src/.+\\.port\\.ts$",
      },
      to: {
        path: "^apps/orchestrator/src/(?:.+/(?:controllers|dto|entities|persistence|services)/|.+\\.entity\\.ts$)",
      },
    },
    {
      name: "orchestrator-controllers-do-not-import-repositories",
      severity: "error",
      from: { path: "^apps/orchestrator/src/.+/controllers/" },
      to: {
        path: "^apps/orchestrator/src/.+/(persistence/|[^/]+\\.repository\\.ts$)",
      },
    },
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
      name: "generated-orchestrator-contracts-only-through-web-boundaries",
      severity: "error",
      from: {
        path: "^apps/web/src/(?!server/orchestrator/|shared/contracts/)",
      },
      to: { path: "^packages/orchestrator-contracts/" },
    },
  ],
  options: {
    tsConfig: { fileName: ".dependency-cruiser.tsconfig.json" },
    exclude: "(^|/)(node_modules|\\.next|dist)(/|$)",
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".mjs"] },
  },
};
