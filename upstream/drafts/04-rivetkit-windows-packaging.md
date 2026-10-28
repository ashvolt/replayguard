<!--
DRAFT: not filed. Requires ReplayGuard maintainer approval (spec 013, FR-004).
Title: rivetkit 2.3.27 cannot run on Windows: empty napi package, engine needs libstdc++-6.dll, wasm cannot spawn the engine
Repo: rivet-dev/rivet (rivetkit-typescript packages)
Labels: bug, windows, packaging
-->

## Summary

On Windows x64 (Node 22), `rivetkit@2.3.27` has no working runtime path. A registry with
`startEngine: true` cannot start, because each of the three ways to run fails:

1. **The native addon package is empty.** `@rivetkit/rivetkit-napi-win32-x64-msvc@2.3.27` is
   published with 2 files and 675 bytes in total: `package.json` and `README.md`. Its `main`
   points at `rivetkit-napi.win32-x64-msvc.node`, which is not in the tarball. For comparison,
   `@rivetkit/rivetkit-napi-linux-x64-gnu@2.3.27` is 46 MB. Loading fails with
   `Cannot find module '…rivetkit-napi.win32-x64-msvc.node'`.
2. **The engine binary needs a DLL that is not shipped.** `@rivetkit/engine-cli-win32-x64`'s
   `rivet-engine.exe` imports `libstdc++-6.dll` (MinGW). On a machine without it, the process
   exits with `0xC0000135` (`STATUS_DLL_NOT_FOUND`). The copy that ships with Git for Windows
   does not help: it exits with `0xC0000139` (`STATUS_ENTRYPOINT_NOT_FOUND`), an ABI mismatch.
3. **The WASM fallback cannot replace either one.**
   - Its default init fetches the `.wasm` through `fetch(file://…)`, which Node rejects
     (`TypeError: fetch failed`). Passing the bytes through `wasm.initInput` works around this.
   - Even then, `startEngine: true` fails with `Invalid wasm configuration field
     'engine_binary_path': wasm runtimes cannot spawn an engine binary`.

## Expected

On Windows x64, either:

- `rivetkit` works with `startEngine: true`: the native addon contains its binary, and the engine
  executable ships its runtime DLLs or is statically linked, as the Linux musl build is; or
- the documentation states that Windows is unsupported, and the packages fail early with a
  clear message.

## Reproduction

```sh
npm view @rivetkit/rivetkit-napi-win32-x64-msvc@2.3.27 dist.fileCount dist.unpackedSize   # 2, 675
npm view @rivetkit/rivetkit-napi-linux-x64-gnu@2.3.27 dist.fileCount dist.unpackedSize    # 3, 46167673
```

```ts
import { actor, setup } from "rivetkit";
import { workflow } from "rivetkit/workflow";
const a = actor({ state: {}, run: workflow(async () => undefined), actions: {} });
setup({ use: { a }, startEngine: true }).start(); // Windows: "RivetKit could not load a core runtime"
```

## A related note for pnpm users (Linux)

The Linux engine binary is published only as a musl build
(`@rivetkit/engine-cli-linux-x64-musl`). pnpm skips optional packages whose `libc` does not
match the host, so on glibc systems (Ubuntu, GitHub runners) the engine is missing until users
set `supportedArchitectures.libc: [current, musl]`. A glibc build, or dropping the `libc`
restriction from the statically linked binary, would avoid this.

## Environment

- `rivetkit` 2.3.27 (the win32 napi package is equally empty in 2.3.11: 2 files, 676 bytes)
- Windows 11 x64, Node 22.14; Linux checks on Ubuntu 24.04 (WSL), Node 22.22
- Found while building [ReplayGuard](https://github.com/ashvolt/replayguard).
