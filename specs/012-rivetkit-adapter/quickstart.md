# Quickstart: RivetKit Adapter

```ts
// checkout.scenario.ts
export const checkoutActor = workflow({ state: {}, run: async (ctx) => { /* steps */ } });
export const scenarioFactory = () => scenario()
  .runtime(rivetkitRuntime({ scenarioModule: import.meta.url, actorName: "checkoutActor" }))
  .effects((ctx) => ({ payment: createFakePayment(ctx) }))
  .faults([fault.killAfter("payment.charge")])
  .build();
```

## Validation scenarios

- Conformance suite passes for engine and actor runtimes with identical outcomes.
- After the suite: no `rivet-engine` processes, no temp dirs left.
