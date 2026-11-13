// Live status page for the Beyond Words build (owner: status panel on the right, NOT yellow → navy + gold).
// Rewrites STATUS.html every 60 s from the setup checklist below + the sample run's log/state.
// Run: node status.mjs   (keeps running; Ctrl+C to stop)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'STATUS.html');
const CHECK = path.join(ROOT, 'status_steps.json');   // [{name, state: done|doing|todo|you}]

function sampleStage() {
  try {
    const run = fs.readdirSync(path.join(ROOT, 'runs')).filter(d => fs.existsSync(path.join(ROOT, 'runs', d, 'state.json'))).sort().pop();
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'runs', run, 'state.json'), 'utf8'));
    const files = fs.readdirSync(path.join(ROOT, 'runs', run));
    const imgs = files.filter(f => /^img\d+\.jpg$/.test(f)).length;
    const shorts = files.filter(f => /^short\d\.mp4$/.test(f)).length;
    return `${s.stage}${s.stage === 'images' ? ` (${imgs} images)` : ''}${shorts ? `, ${shorts} Shorts` : ''}`;
  } catch { return 'not started'; }
}
function lastLog() {
  try { return fs.readFileSync(path.join(ROOT, 'logs', 'sample1.log'), 'utf8').trim().split('\n').slice(-4).join('\n'); } catch { return ''; }
}
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function write() {
  const steps = JSON.parse(fs.readFileSync(CHECK, 'utf8'));
  const pct = Math.round(100 * steps.reduce((n, s) => n + (s.state === 'done' ? 1 : s.state === 'doing' ? 0.5 : 0), 0) / steps.length);
  const icon = { done: '✔', doing: '◐', todo: '○', you: '👆' };
  const html = `<!doctype html><html lang="hi"><head><meta charset="utf-8"><meta http-equiv="refresh" content="60">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Beyond Words Status</title><style>
:root{--bg:#0b1130;--card:#141c46;--gold:#d6a843;--txt:#eef0fb;--mut:#9aa3c7;--ok:#5fd39a;--you:#ff9f6b}
body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.5 'Segoe UI','Noto Sans Devanagari',sans-serif;padding:18px}
h1{font:700 22px Georgia,serif;color:var(--gold);margin:0 0 4px}.sub{color:var(--mut);font-size:13px}
.bar{height:16px;background:#232c63;border-radius:9px;margin:16px 0 6px;overflow:hidden}
.fill{height:100%;width:${pct}%;background:linear-gradient(90deg,#b8862e,var(--gold))}
.pct{font:700 30px Georgia,serif;color:var(--gold)}.card{background:var(--card);border-radius:12px;padding:12px 14px;margin-top:14px}
.s{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #222b5e}.s:last-child{border:0}
.i{width:22px;text-align:center}.done .i{color:var(--ok)}.doing .i{color:var(--gold)}.you{color:var(--you)}.todo{color:var(--mut)}
pre{white-space:pre-wrap;font:12px/1.4 Consolas,monospace;color:var(--mut);margin:6px 0 0}
</style></head><body><h1>Beyond Words — setup</h1><div class="sub">Updated ${new Date().toLocaleTimeString('en-IN')} · refreshes every minute</div>
<div class="bar"><div class="fill"></div></div><div class="pct">${pct}%</div>
<div class="card">${steps.map(s => `<div class="s ${s.state}"><span class="i">${icon[s.state]}</span><span>${esc(s.name)}</span></div>`).join('')}</div>
<div class="card"><b>Sample video:</b> ${esc(sampleStage())}<pre>${esc(lastLog())}</pre></div></body></html>`;
  // the side panel keeps the file open on Windows (rename → EPERM), so overwrite in place
  fs.writeFileSync(OUT, html);
}
try { write(); } catch (e) { console.error(e.message); }
if (!process.argv.includes('--once')) setInterval(() => { try { write(); } catch {} }, 60000);
