import { defineTsupConfig } from "@replayguard-tools/config/tsup";

export default defineTsupConfig({
	entry: { index: "src/index.ts", setup: "src/setup.ts" },
	external: ["vitest"],
});
