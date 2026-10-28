# Repro: a step timeout does not cancel the running call

When a step exceeds its `timeout`, the engine treats the step as failed. It retries the step if
`retryOnTimeout` is set, and otherwise fails the workflow. The `run()` promise that timed out
keeps running, and `ctx.abortSignal` is not aborted, so a call that honors the signal still
completes. As a result:

- with `retryOnTimeout`, the provider is charged twice: once by the call that timed out and once
  by the retry;
- with the default critical timeout, the workflow fails, yet the charge still lands afterwards.
  The effect is orphaned.

```sh
npm i
npm test            # expected behavior: fails today
npm run test:gap    # asserts today's behavior: passes
```

Tested with `@rivet-dev/workflows@1.0.0`, Node 22.
