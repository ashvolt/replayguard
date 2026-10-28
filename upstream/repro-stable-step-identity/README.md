# Repro: no stable step identity for idempotency keys

An idempotency key must be:

- **stable**: the same when a step is re-executed after a crash;
- **unique**: different for each distinct step execution.

Inside a step, the only public identity is `ctx.workflowId`. The engine's own location for the
step (its name plus the loop iteration) is not exposed. As a result, two iterations of
`loopCtx.step("send")` derive the same key from public context. A provider that deduplicates by
key then silently drops the second, legitimate request.

```sh
npm i
npm test            # expected behavior: fails today (both iterations derive "wf-1:send")
npm run test:gap    # asserts today's behavior: passes
```

Tested with `@rivet-dev/workflows@1.0.0`, Node 22. The test also checks that a re-executed
iteration derives the same key (stability), which holds today.
