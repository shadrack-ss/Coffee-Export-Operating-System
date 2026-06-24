/*
 * Architectural boundary rules for CE-OS — machine-enforced module decoupling.
 *
 * Layers (allowed dependency direction, top may use those below):
 *   app      → features, core, shared
 *   features → core, shared   (+ other features ONLY via their index.ts barrel)
 *   core     → shared
 *   shared   → (nothing internal — it's the leaf)
 *
 * Run with:  npm run lint:arch
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make modules impossible to reason about in isolation.",
      from: {},
      to: { circular: true },
    },
    {
      name: "shared-is-leaf",
      severity: "error",
      comment: "shared/ is the leaf kernel — it must not depend on core, features or app.",
      from: { path: "^src/shared/" },
      to: { path: "^src/(core|features|app)/" },
    },
    {
      name: "core-no-upward",
      severity: "error",
      comment: "core/ may use shared only — never features or app.",
      from: { path: "^src/core/" },
      to: { path: "^src/(features|app)/" },
    },
    {
      name: "features-no-app",
      severity: "error",
      comment: "A feature must not depend on the app shell/composition layer.",
      from: { path: "^src/features/" },
      to: { path: "^src/app/" },
    },
    {
      name: "no-deep-cross-feature",
      severity: "error",
      comment:
        "Cross-feature access must go through the other feature's index.ts barrel — no reaching into its internals.",
      from: { path: "^src/features/([^/]+)/" },
      to: {
        path: "^src/features/([^/]+)/.+",
        pathNot: [
          "^src/features/$1/", // same feature: any internal import is fine
          "^src/features/[^/]+/index\\.(ts|tsx)$", // another feature's barrel: allowed
        ],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.app.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
