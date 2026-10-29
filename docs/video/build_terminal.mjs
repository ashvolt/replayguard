// Runs the real `pnpm demo` and turns its output into terminal.html (one screen per act), so the
// video shows exactly what the demo prints. Also copies the demo's HTML reports next to it.
// Usage (repo root, after `pnpm build`): node docs/video/build_terminal.mjs
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const demoDir = join(root, "examples", "checkout-demo");
const out = join(here, "out");
mkdirSync(out, { recursive: true });

const raw = execFileSync(process.execPath, ["demo.mjs"], {
	cwd: demoDir,
	env: { ...process.env, FORCE_COLOR: "1" },
	encoding: "utf8",
});
for (const n of [1, 2, 3])
	copyFileSync(join(demoDir, "reports", `demo-${n}.html`), join(out, `demo-${n}.html`));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const CLASS = { 1: "b", 2: "d", 31: "r", 32: "g", 33: "y" };
function ansiToHtml(text) {
	let html = "";
	const open = [];
	// biome-ignore lint/suspicious/noControlCharactersInRegex: splitting on ANSI escape sequences
	for (const part of text.split(/(\x1b\[\d+m)/)) {
		// biome-ignore lint/suspicious/noControlCharactersInRegex: matching one ANSI escape sequence
		const m = /^\x1b\[(\d+)m$/.exec(part);
		if (!m) {
			html += esc(part);
			continue;
		}
		const code = Number(m[1]);
		if (CLASS[code]) {
			html += `<span class="${CLASS[code]}">`;
			open.push(code);
		} else if ((code === 39 || code === 22) && open.length) {
			html += "</span>";
			open.pop();
		}
	}
	return html + "</span>".repeat(open.length);
}

// Split into acts on the "━━━ n." headers; the final verdict line belongs to act 3.
const acts = raw.split(/\n(?=━━━ \d\.)/).filter((a) => a.startsWith("━━━"));
const screens = acts
	.map((act, i) => {
		const lines = ansiToHtml(act.replace(/\n+$/, "")).split("\n");
		const body = lines
			.map(
				(l, j) =>
					`<div class="l" style="animation-delay:${(j * 0.06).toFixed(2)}s">${l || "&nbsp;"}</div>`,
			)
			.join("");
		return `<section class="screen" id="act${i + 1}"><div class="cmd"><span class="p">replayguard $</span> pnpm demo <span class="d"># act ${i + 1}</span></div>${body}</section>`;
	})
	.join("\n");

writeFileSync(
	join(out, "terminal.html"),
	`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>pnpm demo</title><style>
html,body{margin:0;height:100%;background:#0f1117;color:#d7dae2;overflow:hidden}
.bar{height:44px;background:#1b1e27;display:flex;align-items:center;gap:9px;padding:0 18px}
.bar i{width:13px;height:13px;border-radius:50%;display:inline-block}
.bar span{margin-left:14px;color:#8a90a0;font:15px "Segoe UI",sans-serif}
.screen{display:none;padding:22px 30px;font:17px/1.42 Consolas,"Cascadia Code",monospace;white-space:pre}
.screen.on{display:block}
.l{opacity:0;animation:show .25s ease forwards}
@keyframes show{to{opacity:1}}
.cmd{margin-bottom:10px}.p{color:#7aa2ff}
.b{font-weight:700;color:#fff}.d{color:#7f8697}.r{color:#ff6b6b}.g{color:#5fd38d}.y{color:#f2c94c}
</style></head><body>
<div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>examples/checkout-demo — real output of pnpm demo</span></div>
${screens}
<script>const show=()=>{const id=location.hash.slice(1)||"act1";for(const s of document.querySelectorAll(".screen"))s.classList.toggle("on",s.id===id)};addEventListener("hashchange",show);show();</script>
</body></html>`,
);
console.log(`terminal.html: ${acts.length} acts; reports copied to ${out}`);
