# Demo video

A ~5-minute narrated walkthrough for the Rivet team and for engineers who run durable
workflows: the double-charge problem, how ReplayGuard works, the three-act `pnpm demo`, the
three runtimes, and the engine behaviours it found.

Everything on screen is real: the terminal screens are the captured output of `pnpm demo`, and the
report is the HTML that act 1 writes. The explanatory cards are [cards.html](cards.html).

| File | What it is |
|---|---|
| [script.py](script.py) | 13 scenes: browser actions and narration. The only file carrying copy. |
| [cards.html](cards.html) | The explanatory cards. |
| [build_terminal.mjs](build_terminal.mjs) | Runs the real demo; writes `out/terminal.html` and copies its reports. |
| [record.py](record.py) | Synthesises the voice, drives Chromium on that clock, records, writes `out/timeline.json`. |
| [assemble.py](assemble.py) | Lays the narration on the measured timeline, writes the `.srt`, encodes the mp4. |

## Build it

```bash
pnpm build
node docs/video/build_terminal.mjs
cd docs/video
pip install playwright kokoro-onnx soundfile imageio-ffmpeg numpy
python -m playwright install chromium
# Kokoro-82M model files (kokoro-v1.0.onnx, voices-v1.0.bin) from
# github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
REPLAYGUARD_TTS_MODELS=/path/to/models python record.py   # ~5 min, records in real time
python assemble.py                                          # -> out/replayguard-demo.mp4 + .srt
```

The voice is Kokoro `am_michael` (US English), synthesised locally: no API key, no network.
`record.py` reuses `out/voice/*.wav`; delete that folder after changing narration. Keep the
`.srt` next to the `.mp4` so players load the subtitles. `out/` and `models/` are gitignored.

Adapted from the walkthrough pipeline in the artwork-preflight project.
