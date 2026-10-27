# Contract: Report & Reporters

## `@replayguard/core`

```ts
export function buildReport(classified: ClassifiedResult, options?: { clock?: Clock }): Report;
export function reportToJson(report: Report): string;
export function parseReport(json: string): Report;          // throws SchemaError

export interface ReportVisitor<T> {
  visitReport?(report: Report): void;
  visitCase?(c: CaseReport, report: Report): void;
  visitEffect?(e: EffectReport, c: CaseReport): void;
  visitTimelineEvent?(e: TimelineEvent, c: CaseReport): void;
  result(): T;
}
export function walkReport<T>(report: Report, visitor: ReportVisitor<T>): T;

export interface Reporter<T = string> { readonly name: string; render(report: Report): T | Promise<T> }
```

## `@replayguard/reporter-console`

```ts
export function renderConsole(report: Report, options?: { verbose?: boolean; color?: boolean }): string;
export function consoleReporter(options?: { verbose?: boolean; color?: boolean;
  write?: (s: string) => void }): Reporter<void>;
```

## `@replayguard/reporter-html`

```ts
export function renderHtml(report: Report, options?: { title?: string }): Promise<string>;
export function writeHtmlReport(report: Report, path: string): Promise<void>;
```
