// Package boundary rules — constitution v1.0.0, Principle III (allowed edges only).
// Paths are relative to the repository root. Workspace imports resolve to `packages/<name>/dist`
// when built; unresolved bare specifiers (`@replayguard/x`) are matched by name as a fallback.

/** Regex matching any ReplayGuard package other than the allowed ones. */
function otherThan(...allowed) {
	const dirs = allowed.map((n) => `${n}/`).join("|");
	const names = allowed.map((n) => `${n}(/|$)`).join("|");
	return `^(packages/(?!${dirs})|@replayguard/(?!${names})|replayguard$)`;
}

const NPM = [
	"npm",
	"npm-dev",
	"npm-optional",
	"npm-peer",
	"npm-bundled",
	"npm-no-pkg",
	"npm-unknown",
	"unknown",
];

/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "core-no-node-builtins",
			comment: "core is pure TypeScript: no node:* or other runtime built-ins",
			severity: "error",
			from: { path: "^packages/core/src" },
			to: { dependencyTypes: ["core"] },
		},
		{
			name: "core-only-valibot",
			comment: "core may only depend on valibot from npm",
			severity: "error",
			from: { path: "^packages/core/src" },
			to: { dependencyTypes: NPM, pathNot: "(^|/)valibot(/|$)" },
		},
		{
			name: "core-no-other-packages",
			severity: "error",
			from: { path: "^packages/core/src" },
			to: { path: otherThan("core") },
		},
		{
			name: "no-rivet-outside-adapters",
			comment: "only adapter packages may import Rivet (Principle V)",
			severity: "error",
			from: { path: "^packages/", pathNot: "^packages/adapter-(workflows|rivetkit)/" },
			to: { path: "(^|/)(@rivet-dev/|rivetkit(/|$))" },
		},
		{
			name: "fakes-only-core",
			severity: "error",
			from: { path: "^packages/fakes/src" },
			to: { path: otherThan("core", "fakes") },
		},
		{
			name: "reporters-only-core",
			severity: "error",
			from: { path: "^packages/reporter-(console|html)/src" },
			to: { path: otherThan("core", "reporter-$1") },
		},
		{
			name: "vitest-only-core",
			severity: "error",
			from: { path: "^packages/vitest/src" },
			to: { path: otherThan("core", "vitest") },
		},
		{
			name: "adapter-workflows-only-core",
			severity: "error",
			from: { path: "^packages/adapter-workflows/src" },
			to: { path: otherThan("core", "adapter-workflows") },
		},
		{
			name: "adapter-rivetkit-only-core-and-workflows",
			severity: "error",
			from: { path: "^packages/adapter-rivetkit/src" },
			to: { path: otherThan("core", "adapter-workflows", "adapter-rivetkit") },
		},
		{
			name: "facade-only-core-fakes-vitest",
			severity: "error",
			from: { path: "^packages/replayguard/src" },
			to: { path: otherThan("core", "fakes", "vitest", "replayguard") },
		},
		{
			name: "no-deep-imports",
			comment: "import other packages through their public exports, never their src",
			severity: "error",
			from: { path: "^packages/([^/]+)/" },
			to: { path: "^packages/[^/]+/src/", pathNot: "^packages/$1/" },
		},
		{
			name: "no-circular",
			severity: "error",
			from: {},
			to: { circular: true },
		},
	],
	options: {
		doNotFollow: { path: "node_modules" },
		exclude: { path: "(^|/)(test|dist|coverage|reports)/|\\.config\\.(ts|mjs|cjs)$" },
		tsPreCompilationDeps: true,
		combinedDependencies: true,
		enhancedResolveOptions: {
			exportsFields: ["exports"],
			conditionNames: ["import", "require", "node", "default", "types"],
			extensions: [".ts", ".js", ".mjs", ".cjs", ".d.ts"],
		},
		reporterOptions: { text: { highlightFocused: true } },
	},
};
