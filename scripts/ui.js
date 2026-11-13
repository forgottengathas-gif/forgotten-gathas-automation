// On-screen motion graphics (from Beyond Words, 2026-11-12; Forgotten Gathas uses text + doc): WhatsApp chat, phone call, bank balance,
// the "हिसाब" note, a legal document, big text lines. Each scene renders as a few transparent 1920x1080 PNG
// "states" (message 1, then 1+2, ...) by headless Chrome (Devanagari shaped by the browser); render.js overlays them
// over a blurred story picture with fades and a soft notification sound per new state.
// Usage (test): node scripts/ui.js '<json ui>' <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.js';

const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
  .find(p => p && fs.existsSync(p));

// fonts embedded as data: URLs (a file:// font once fell back to a thin system font in headless Chrome)
let FONTS = null;
const fontCss = () => FONTS ??= [['M', 'Mukta-ExtraBold.ttf'], ['N', 'NotoSansDevanagari-Variable.ttf'], ['T', 'TiroDevanagariHindi-Regular.ttf']]
  .map(([n, f]) => `@font-face{font-family:${n};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64')});font-weight:100 900}`).join('');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (a, n) => (Array.isArray(a) ? a : []).filter(Boolean).slice(-n);

const BASE = `*{margin:0;box-sizing:border-box}html,body{width:1920px;height:1080px;overflow:hidden;background:transparent}
body{font-family:N,M,sans-serif;color:#111}
.phone{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) scale(0.86);width:560px;height:980px;border-radius:64px;
background:#0d0d0f;padding:18px;box-shadow:0 40px 120px rgba(0,0,0,.65),0 0 0 3px #2c2c30}
.scr{width:100%;height:100%;border-radius:48px;overflow:hidden;position:relative;display:flex;flex-direction:column}
.bar{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 34px;font:600 22px N;color:#fff}`;

function page(body, css = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}${BASE}${css}</style></head><body>${body}</body></html>`;
}

// each builder returns an array of HTML pages (one per state)
const BUILD = {
  whatsapp(u) {
    const msgs = clamp(u.messages, 6).map(m => ({ me: m.from === 'me' || m.from === 'मैं', from: m.from, text: m.text }));
    const css = `.scr{background:#0b141a}.hd{background:#1f2c34;color:#e9edef;padding:18px 26px;display:flex;gap:18px;align-items:center}
.av{width:58px;height:58px;border-radius:50%;background:#6a7175;display:grid;place-items:center;font:800 28px M;color:#fff}
.tt{font:700 28px N}.sub{font:400 19px N;color:#8696a0}
.chat{flex:1;padding:22px 20px;display:flex;flex-direction:column;gap:14px;justify-content:flex-end;
background:#0b141a radial-gradient(circle at 20% 30%,#10202a 0,transparent 40%)}
.m{max-width:82%;padding:12px 18px 10px;border-radius:16px;font:500 27px/1.35 N;color:#e9edef;position:relative}
.in{background:#202c33;align-self:flex-start;border-top-left-radius:4px}.out{background:#005c4b;align-self:flex-end;border-top-right-radius:4px}
.nm{font:700 20px N;color:#53bdeb;margin-bottom:4px}.tm{font:400 16px N;color:#8696a0;text-align:right;margin-top:4px}
.new{animation:none;box-shadow:0 0 0 3px rgba(37,211,102,.55)}`;
    const states = [];
    for (let k = 0; k < Math.max(1, msgs.length); k++) {
      const html = msgs.slice(0, k + 1).map((m, i) => `<div class="m ${m.me ? 'out' : 'in'} ${i === k ? 'new' : ''}">${!m.me ? `<div class="nm">${esc(m.from)}</div>` : ''}${esc(m.text)}<div class="tm">${9 + i}:4${i} PM${m.me ? ' ✓✓' : ''}</div></div>`).join('');
      states.push(page(`<div class="phone"><div class="scr"><div class="bar"><span>9:41</span><span>▮▮▮ 5G</span></div>
<div class="hd"><span style="font-size:30px;color:#e9edef">←</span><div class="av">${esc(String(u.title || 'F')[0])}</div><div><div class="tt">${esc(u.title || 'Family')}</div>
<div class="sub">${msgs.length > 2 ? 'group · ' + (msgs.length + 30) + ' members' : 'online'}</div></div></div><div class="chat">${html}</div></div></div>`, css));
    }
    return states;
  },
  call(u) {
    const css = `.scr{background:linear-gradient(180deg,#1b2735,#0c1118);color:#fff;align-items:center;text-align:center}
.av{margin-top:150px;width:200px;height:200px;border-radius:50%;background:#3a4a5c;display:grid;place-items:center;font:800 96px M;color:#dfe8f1}
.nm{margin-top:40px;font:800 54px M}.st{margin-top:14px;font:500 28px N;color:#9fb3c8}
.btns{position:absolute;bottom:110px;left:0;right:0;display:flex;justify-content:space-around}
.b{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;font:700 54px sans-serif}`;
    const ended = u.state === 'ended';
    const one = (st, btns) => page(`<div class="phone"><div class="scr"><div class="bar" style="width:100%"><span>9:41</span><span>▮▮▮</span></div>
<div class="av">${esc(String(u.name || '?')[0])}</div><div class="nm">${esc(u.name || 'Unknown')}</div><div class="st">${st}</div>
<div class="btns">${btns}</div></div></div>`, css);
    if (ended) return [one('Call ended · ' + esc(u.duration || '0:42'), '')];
    return [one('incoming call…', '<div class="b" style="background:#e53935">✕</div><div class="b" style="background:#2e7d32">✆</div>'),
      one('00:0' + (3 + Math.floor(Math.random() * 6)), '<div class="b" style="background:#e53935">✕</div>')];
  },
  bank(u) {
    const css = `.scr{background:#f4f6fb}.top{background:linear-gradient(135deg,#0b3d91,#1565c0);color:#fff;padding:40px 34px 60px}
.bk{font:800 30px M;letter-spacing:.5px}.lb{margin-top:60px;font:500 26px N;opacity:.85}.amt{margin-top:10px;font:800 66px M}
.card{margin:-34px 26px 0;background:#fff;border-radius:22px;padding:26px 28px;box-shadow:0 10px 30px rgba(0,0,0,.12)}
.r{display:flex;justify-content:space-between;font:500 24px N;color:#444;padding:10px 0;border-bottom:1px solid #eee}
.ok{margin-top:22px;font:700 24px N;color:#2e7d32}`;
    const pageFor = shown => page(`<div class="phone"><div class="scr"><div class="bar" style="color:#fff;position:absolute;width:100%"><span>9:41</span><span>▮▮▮</span></div>
<div class="top"><div class="bk">◆ MyBank</div><div class="lb">${esc(u.label || 'Balance')}</div><div class="amt">${shown}</div></div>
<div class="card"><div class="r"><span>A/c</span><span>XXXX 4417</span></div><div class="r"><span>Remark</span><span>${esc(u.remark || '—')}</span></div>
<div class="ok">✔ ${u.label === 'Debited' ? 'Transaction successful' : 'Updated just now'}</div></div></div></div>`, css);
    return [pageFor('₹ • • • • • •'), pageFor(esc(u.amount || '₹0'))];
  },
  note(u) {
    // short, readable lines: the newest 4, each cut at ~70 characters on a word boundary
    const short = l => { const s = String(l).trim(); if (s.length <= 72) return s; const c = s.slice(0, 70); return c.slice(0, c.lastIndexOf(' ') > 40 ? c.lastIndexOf(' ') : 70) + '…'; };
    const lines = clamp(u.lines, 4).map(short);
    const css = `.scr{background:#fffdf4}.hd{padding:26px 30px 10px;font:800 50px T;color:#7a1f1f;border-bottom:2px solid #f0e2c0}
.ls{padding:18px 30px;display:flex;flex-direction:column;gap:20px}
.l{font:600 31px/1.4 N;color:#2b2b2b;padding-left:24px;position:relative}.l:before{content:'•';position:absolute;left:0;color:#b33}
.nw{background:#fff2b8;border-radius:8px;padding:6px 10px 6px 28px;font-weight:600}`;
    const pageFor = n => page(`<div class="phone"><div class="scr"><div class="bar" style="color:#555"><span>9:41</span><span>Notes</span></div>
<div class="hd">${esc(u.title || 'नोट्स')}</div><div class="ls">${lines.slice(0, n).map((l, i) => `<div class="l ${i === n - 1 && n === lines.length ? 'nw' : ''}">${esc(l)}</div>`).join('')}</div></div></div>`, css);
    return lines.length > 1 ? [pageFor(lines.length - 1), pageFor(lines.length)] : [pageFor(1)];
  },
  // owner 2026-11-13: history look — an aged parchment / bhojpatra with a red wax seal (no modern paper, no "STAMP")
  doc(u) {
    const lines = clamp(u.lines, 5), hl = String(u.highlight || '');
    const mark = t => hl && esc(t).includes(esc(hl)) ? esc(t).replace(esc(hl), `<mark>${esc(hl)}</mark>`) : esc(t);
    const css = `.sheet{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-1.2deg);width:980px;min-height:760px;
padding:80px 96px;font-family:T,N;color:#3b2410;
background:radial-gradient(ellipse at 30% 20%,#f4e2b8 0%,#e6c98f 55%,#c99a5b 100%);
box-shadow:0 30px 90px rgba(0,0,0,.75),inset 0 0 120px rgba(110,60,20,.55),inset 0 0 18px rgba(80,40,10,.6);
border-radius:6px 14px 8px 18px/18px 6px 14px 8px}
.sheet:before{content:"";position:absolute;inset:26px;border:3px double rgba(110,60,20,.55);border-radius:4px}
.h{position:relative;text-align:center;font:400 54px/1.3 T;color:#6b1d0c;padding-bottom:20px;border-bottom:2px solid rgba(110,60,20,.5)}
.p{position:relative;margin-top:28px;font:400 36px/1.55 T;color:#3b2410}mark{background:none;color:#9b1b0b;border-bottom:4px solid rgba(155,27,11,.6)}
.seal{position:absolute;right:80px;bottom:56px;width:150px;height:150px;border-radius:50%;
background:radial-gradient(circle at 35% 30%,#d4442c,#8e1a0d 60%,#5a0c05);box-shadow:0 8px 20px rgba(0,0,0,.5),inset 0 0 0 10px rgba(255,255,255,.08);
display:grid;place-items:center;color:rgba(255,220,180,.85);font:400 60px T}`;
    const pageFor = withHl => page(`<div class="sheet"><div class="h">${esc(u.title || 'फ़रमान')}</div>
${lines.map(l => `<div class="p">${withHl ? mark(l) : esc(l)}</div>`).join('')}<div class="seal">☀</div></div>`, css);
    return hl ? [pageFor(false), pageFor(true)] : [pageFor(false)];
  },
  // owner 2026-11-13 (reference style): big golden 3D title words. Every state lays out ALL lines (later ones hidden)
  // so the block never re-centres — the old version re-centred and the words printed on top of each other.
  text(u) {
    const lines = clamp(u.lines, 3);
    const css = `.w{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:18px}
.t{font:800 128px/1.15 M;max-width:1700px;text-align:center;letter-spacing:1px;
background:linear-gradient(180deg,#fff6c8 0%,#ffd45a 38%,#e09b1c 62%,#a8620c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
filter:drop-shadow(0 2px 0 #7a4308) drop-shadow(0 4px 0 #6a3906) drop-shadow(0 6px 0 #5a3005) drop-shadow(0 8px 0 #4a2704)
drop-shadow(0 18px 24px rgba(0,0,0,.85)) drop-shadow(0 0 30px rgba(255,170,40,.35))}
.t.s{font-size:84px}.h{visibility:hidden}`;
    return lines.map((_, k) => page(`<div class="w">${lines.map((l, j) => `<div class="t${j ? ' s' : ''}${j > k ? ' h' : ''}">${esc(l)}</div>`).join('')}</div>`, css));
  },
};

// → [{png}] transparent states for one ui scene
export function renderUi(ui, outDir) {
  const build = BUILD[ui?.type];
  if (!build) throw new Error('unknown ui type ' + ui?.type);
  fs.mkdirSync(outDir, { recursive: true });
  const pages = build(ui);
  return pages.map((html, k) => {
    const png = path.join(outDir, `s${k}.png`);
    if (fs.existsSync(png)) return png;
    const f = path.join(outDir, `s${k}.html`);
    fs.writeFileSync(f, html);
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox', '--default-background-color=00000000',
      '--window-size=1920,1080', `--screenshot=${png}`, '--virtual-time-budget=1500', pathToFileURL(f).href], { stdio: 'ignore' });
    fs.unlinkSync(f);
    if (!fs.existsSync(png)) throw new Error('ui screenshot failed');
    return png;
  });
}

if (process.argv[1]?.endsWith('ui.js')) {
  console.log(renderUi(JSON.parse(process.argv[2]), process.argv[3]));
}
