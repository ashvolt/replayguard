import { defineTsupConfig } from "@replayguard-tools/config/tsup";

export default defineTsupConfig({
	entry: { index: "src/index.ts", "host/host-entry": "src/host/host-entry.ts" },
	external: ["rivetkit"],
	shims: true,
});
