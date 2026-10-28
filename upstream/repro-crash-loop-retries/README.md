# Repro: crash loops bypass `maxRetries`

A step with `maxRetries: 2` should run at most 3 times. If the process crashes while `run()` is
executing, the attempt counter has not been persisted yet. Every restart therefore starts again
at attempt 1, and the step runs again with no bound. A non-idempotent call inside the step, such
as a charge, repeats once per crash.

```sh
npm i
npm test            # expected behavior: fails today (6 executions, limit 3)
npm run test:gap    # asserts today's behavior: passes
```

Tested with `@rivet-dev/workflows@1.0.0`, Node 22. Crashes are simulated by an `InMemoryDriver`
whose writes fail after `crash()`; a restart is a new `runWorkflow` call on the same storage.
