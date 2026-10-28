/** Inline stylesheet (light and dark schemes, narrow screens, patterns for color-blind users). */
export const STYLES = `:root{color-scheme:light dark;--bg:#fff;--fg:#1d1d1f;--muted:#5f6368;--line:#d0d4da;--panel:#f5f6f8;--pass:#1a7f37;--warn:#9a6700;--fail:#cf222e;--bar:#3b6fd8;--run:#e8edf6}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--fg:#e6e6e6;--muted:#9aa0a6;--line:#30363d;--panel:#161b22;--pass:#3fb950;--warn:#d29922;--fail:#f85149;--bar:#6e9cf5;--run:#1c2433}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header,main{max-width:1100px;margin:0 auto;padding:16px}h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.15rem;margin:0 0 8px}h4{margin:8px 0 4px}
.rg-muted,.rg-meta{color:var(--muted)}section{border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:12px 0;background:var(--panel)}
.rg-badge{display:inline-block;border:1px solid currentColor;border-radius:4px;padding:0 6px;font-size:.8rem;font-weight:600;white-space:nowrap}
.rg-v-pass,.rg-o-exactly-once,.rg-o-deduplicated{color:var(--pass)}.rg-v-warn{color:var(--warn)}.rg-v-fail,.rg-o-duplicated,.rg-o-concurrent-duplicate,.rg-o-orphaned,.rg-o-skipped{color:var(--fail)}
.rg-o-deduplicated,.rg-o-concurrent-duplicate{border-style:dashed}.rg-o-orphaned,.rg-o-skipped{border-style:dotted}
.rg-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);vertical-align:top}
pre{background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px;overflow-x:auto}code{font:13px/1.4 ui-monospace,Consolas,monospace}
details{margin:6px 0}summary{cursor:pointer}summary:focus-visible,select:focus-visible{outline:2px solid var(--bar);outline-offset:2px}
.rg-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:center}select{font:inherit;padding:2px 6px}
.rg-timeline{width:100%;height:auto;display:block;margin-top:8px}.rg-lane-label,.rg-fault-label{font-size:11px;fill:var(--muted)}.rg-lane-sep{stroke:var(--line)}
.rg-run{fill:var(--run)}.rg-bar{fill:var(--bar);stroke:var(--bar);stroke-width:1.5}.rg-pat-bg{fill:var(--run)}.rg-pat-fg{fill:var(--bar)}.rg-pat-line{stroke:var(--bar);stroke-width:1.5}
.rg-fault{stroke:var(--fail);stroke-width:2;stroke-dasharray:3 2}dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0}dt{color:var(--muted)}dd{margin:0}
.rg-legend{display:flex;flex-wrap:wrap;gap:8px 16px;list-style:none;padding:0;margin:0}.rg-warnings{color:var(--warn)}`;

/** Inline filter script (≤ 2 KB): hides case sections by verdict and outcome. */
export const FILTER_SCRIPT = `(()=>{const d=document,v=d.getElementById("rg-verdict"),o=d.getElementById("rg-outcome"),n=d.getElementById("rg-count"),t=JSON.parse(d.getElementById("rg-data").textContent).cases.length,s=[...d.querySelectorAll(".rg-case")];const f=()=>{let k=0;for(const e of s){const h=(v.value&&e.dataset.verdict!==v.value)||(o.value&&!e.dataset.outcomes.split(" ").includes(o.value));e.hidden=!!h;if(!h)k++}n.textContent=k+" of "+t+" cases shown"};v.addEventListener("change",f);o.addEventListener("change",f)})();`;
