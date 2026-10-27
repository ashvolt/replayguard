# Quickstart: Upstream Proposal

1. `pnpm --filter "./upstream/*" test` with `EXPECT_GAP=1` → all green (gaps still present).
2. Without `EXPECT_GAP` → each repro fails, demonstrating the gap.
3. Review drafts in `upstream/drafts/`; after maintainer approval, file with
   `gh issue create --repo rivet-dev/workflows --title … --body-file …` and update the tracker.
