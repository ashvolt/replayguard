# Quickstart: Reporters

```ts
import { buildReport, classify } from "@replayguard/core";
import { renderConsole } from "@replayguard/reporter-console";
import { writeHtmlReport } from "@replayguard/reporter-html";

const report = buildReport(classify(await checkout.run()));
console.log(renderConsole(report));
await writeHtmlReport(report, "reports/checkout.html");
```

## Validation scenarios

- `NO_COLOR=1` → no `\x1b[` sequences in output.
- Subject `"<script>alert(1)</script>"` → appears escaped in HTML; no script executes.
- `parseReport(reportToJson(r))` deep-equals `r`.
- 100-case report HTML < 1 MB.
