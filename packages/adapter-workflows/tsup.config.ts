import { defineTsupConfig } from "@replayguard-tools/config/tsup";

export default defineTsupConfig({
	entry: { index: "src/index.ts", "process/child-entry": "src/process/child-entry.ts" },
	shims: true,
});
