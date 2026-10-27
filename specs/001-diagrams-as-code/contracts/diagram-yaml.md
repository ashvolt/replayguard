# Contract: `diagram.yaml`

```yaml
feature: 004-effect-ledger
diagrams:
  - kind: hld
    title: Effect ledger in context
    layout: flow
    direction: LR
    groups:
      - { id: core, label: "@replayguard/core" }
    nodes:
      - { id: workflow, label: User workflow step, shape: ellipse }
      - { id: instrument, label: instrument(), group: core, tasks: [T010, T011] }
      - { id: ledger, label: EffectLedger, group: core, shape: database, tasks: [T008] }
    edges:
      - { from: workflow, to: instrument, label: calls }
      - { from: instrument, to: ledger, label: records }
  - kind: workflow
    title: Recording an attempt
    layout: sequence
    actors:
      - { id: step, label: Workflow step }
      - { id: wrap, label: instrumented fn }
      - { id: ledger, label: EffectLedger }
    messages:
      - { from: step, to: wrap, label: "charge(order)", tasks: [T010] }
      - { from: wrap, to: ledger, label: attemptStarted, tasks: [T012] }
      - { from: ledger, to: step, label: result, style: dashed }
```

Validation errors are reported as `<file>:<keyPath>: <message>`, e.g.
`specs/004-effect-ledger/diagram.yaml:diagrams[0].edges[1].to: unknown node "ledgr"`.
