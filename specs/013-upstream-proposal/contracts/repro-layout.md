# Contract: Reproduction package layout

```text
upstream/repro-<name>/
├── package.json        # deps: @rivet-dev/workflows (pinned), vitest; scripts: test
├── test/repro.test.ts  # asserts expected behavior; EXPECT_GAP=1 inverts
└── README.md           # one-paragraph summary, how to run, observed vs expected
```

Run: `pnpm --filter ./upstream/repro-<name> test` (or `npm i && npm test` standalone).
