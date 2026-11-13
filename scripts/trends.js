// Topic research for Forgotten Gathas (owner 2026-11-12): take the subjects of the TOP-PERFORMING videos of Indian
// Hindi history competitors and make our own, better video on the same subject — our own script, and our title is
// ALWAYS freshly worded (never a competitor's title). Skips every subject we already made.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, aiJson, log } from './lib.js';
import { topRecent, channelSubs, topComments } from './yt.js';

// Formats rotate (least recently used first) so the channel covers all kinds of gathas.
export const FORMATS = [
  { id: 'warrior', name: 'The life saga of a great Indian warrior king or queen (rise, defining battles, legacy)',
    queries: ['महान योद्धा की कहानी', 'veer yodha history hindi', 'राजपूत इतिहास'] },
  { id: 'battle', name: 'One decisive battle or siege of Indian history told minute by minute (causes, armies, the turn, aftermath)',
    queries: ['युद्ध का इतिहास', 'battle history hindi documentary', 'भारत के महान युद्ध'] },
  { id: 'empire', name: 'The rise and fall of an Indian dynasty or empire (Maurya, Gupta, Chola, Vijayanagara, Maratha, Mughal, Sikh...)',
    queries: ['साम्राज्य का इतिहास', 'empire history hindi', 'राजवंश का इतिहास'] },
  { id: 'forgotten', name: 'A forgotten hero, queen, scholar or event of Indian history that most people never heard of',
    queries: ['भूले हुए नायक', 'unknown history of india hindi', 'इतिहास के अनसुने किस्से'] },
  { id: 'mystery', name: 'A mystery, treasure, lost city, fort or temple of Indian history and what the evidence really says',
    queries: ['इतिहास का रहस्य', 'mystery history hindi', 'खजाने का रहस्य इतिहास'] },
  { id: 'freedom', name: 'A saga of the freedom struggle (1757-1947): revolt, revolutionaries, a turning-point event',
    queries: ['स्वतंत्रता संग्राम की कहानी', 'freedom fighter story hindi', '1857 की क्रांति'] },
  { id: 'ancient', name: 'Ancient India: a great ruler, university, invention, journey or civilisation (Indus, Vedic, Mauryan, Gupta)',
    queries: ['प्राचीन भारत का इतिहास', 'ancient india history hindi', 'सिंधु घाटी सभ्यता'] },
];
export const CATEGORIES = ['history'];
export const catOf = () => 'history';
export const CATEGORY_NAMES = { history: 'इतिहास की गाथाएँ' };
export const nextCategory = () => 'history';

const STATE = path.join(ROOT, 'state');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(STATE, f), 'utf8')); } catch { return d; } };

// the format we used least recently (never-used first)
export function nextFormat() {
  const used = readJson('topics.json', []);
  const last = Object.fromEntries(FORMATS.map(f => [f.id, -1]));
  used.forEach((u, i) => { if (u.format in last) last[u.format] = i; });
  return FORMATS.slice().sort((a, b) => last[a.id] - last[b.id])[0];
}

// History is evergreen: look at the last 12 months, rank by views/day × how far a video beat its channel's size.
export async function researchTrends(format = nextFormat()) {
  const seen = new Map();
  for (const q of [...format.queries, 'इतिहास hindi documentary']) {
    try { for (const v of await topRecent(q, 365)) seen.set(v.id, v); } catch (e) { log('search failed', q, e.message.slice(0, 120)); }
  }
  // Shorts (< 6 min) and live streams/podcasts (> 90 min) are not our format
  const vids = [...seen.values()].filter(v => v.minutes >= 6 && v.minutes <= 90);
  const subs = await channelSubs([...new Set(vids.map(v => v.channelId))]).catch(e => { log('subs failed', e.message.slice(0, 120)); return {}; });
  for (const v of vids) {
    v.subs = subs[v.channelId] || 0;
    v.outlier = +(v.views / Math.max(1000, v.subs)).toFixed(2);
    v.score = Math.round(v.perDay * Math.sqrt(Math.min(50, Math.max(0.1, v.outlier))));
  }
  const list = vids.sort((a, b) => b.score - a.score).slice(0, 40);
  const requests = await viewerRequests(list);
  fs.writeFileSync(path.join(STATE, 'trends.json'), JSON.stringify({ at: new Date().toISOString(), format: format.id, list, requests }, null, 2));
  log('top history videos', list.length, 'best', list[0]?.perDay, '/day, outlier', list[0]?.outlier, '| viewer requests', requests.length);
  return Object.assign(list, { requests });
}

// "make a video on X" comments under the top videos and our own uploads (needs YT_API_KEY, else none)
const ASK = /(video|part ?2|next|please|pls|banao|बनाओ|बनाइए|भाग 2|अगला|पर भी|के बारे में)/i;
async function viewerRequests(list) {
  const ours = readJson('uploads.json', []).slice(-10).map(u => ({ id: u.id, title: u.title, own: true }));
  const out = [];
  for (const v of [...ours, ...list.slice(0, 8)]) {
    for (const c of await topComments(v.id)) {
      if (ASK.test(c.text) && c.text.length < 280) out.push({ on: v.title, own: !!v.own, likes: c.likes, text: c.text.replace(/\s+/g, ' ') });
    }
  }
  return out.sort((a, b) => (b.own - a.own) || (b.likes - a.likes)).slice(0, 25);
}

const fits = t => FORMATS.some(f => f.id === t.format) && String(t.topic || '').length > 5 && t.title;
const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export async function pickTopic(trending, format = nextFormat(), audience = null) {
  const used = readJson('topics.json', []);
  const learn = readJson('learnings.json', {});
  const lines = [
    `You plan videos for "Forgotten Gathas", a Hindi history documentary channel (15-20 min, realistic cinematic ` +
    `visuals, Indian Hindi-speaking audience).`,
    `This video's FORMAT: ${format.name} (format id "${format.id}").`,
    `OWNER RULE: pick the SUBJECT of one of the best-performing competitor videos below (history is shared, so the ` +
    `same king/battle/event is fine) and plan a deeper, better-told video on it. Our TITLE must be completely our own ` +
    `wording: never copy or lightly edit a competitor title.`,
    `Top Hindi history videos (title | views/day | outlier = views ÷ the channel's subscribers; above 1 means the ` +
    `SUBJECT pulled viewers, not the channel's fame):`,
    ...trending.map(v => `- ${v.title} | ${v.perDay} | ${v.outlier ?? '?'}x`),
  ];
  if (trending.requests?.length) {
    lines.push('', 'What viewers ask for in comments (likes; "OUR" = our own channel, weigh these most):',
      ...trending.requests.map(r => `- ${r.own ? 'OUR ' : ''}(${r.likes}) ${r.text}`));
  }
  if (audience?.wants?.length) {
    lines.push('', 'Competitor analysis (what this audience demands; strength 1-10):',
      ...audience.wants.map(w => `- [${w.strength}] ${w.topic} — ${w.evidence}`));
    if (audience.gaps?.length) lines.push(`Gaps viewers say nobody covers well: ${audience.gaps.join('; ')}`);
    if (audience.saturated?.length) lines.push(`Saturated right now (only with a truly new angle): ${audience.saturated.join('; ')}`);
  }
  lines.push('',
    `What worked / didn't on OUR channel so far: ${JSON.stringify(learn.summary || 'no data yet')}`,
    `Subjects we already made (never repeat): ${used.map(u => u.topic).join('; ') || 'none'}`, '',
    `Propose 5 subjects for THIS FORMAT ranked by expected views, each taken from the demand above. RULES: well-` +
    `documented history with real sources (inscriptions, chronicles, historians), not mainly a folk legend; never ` +
    `framed around a caste, religion or community identity ("X समाज के नायक", "हिंदू बनाम मुस्लिम"); present every ` +
    `figure as an Indian historical figure; no communal or political angle; disputed religious sites are allowed but only told neutrally (documented history, no verdict, no blame).`,
    `Return JSON {"topics":[{"topic":"the subject + angle in Hindi (Devanagari), 1-2 specific sentences",` +
    `"angle":"the hook in one Hindi line","based_on":"the competitor video title it comes from","why":"why it will get views",` +
    `"title":"OUR YouTube title in Hindi (Devanagari), fresh wording, max 80 chars","map_place":"main real place, ` +
    `in English, for a map (e.g. Haldighati, Rajasthan, India)","format":"${format.id}"}]}`);
  const { data, model } = await aiJson(lines.join('\n'),
    { check: d => { (d.topics || []).forEach(t => { t.format ||= format.id; }); if (!d.topics?.some(fits)) throw new Error('no topics for the format'); return d; }, temperature: 0.9 },
  );
  const usedSet = new Set(used.map(u => norm(u.topic)));
  const theirs = new Set(trending.map(v => norm(v.title)));
  const pick = data.topics.find(t => fits(t) && !usedSet.has(norm(t.topic)) && !theirs.has(norm(t.title)));
  if (!pick) throw new Error('no fresh topic in the AI reply');
  log('topic by', model, '→', pick.topic, '| from:', pick.based_on);
  return { ...pick, candidates: data.topics };
}

if (process.argv[1]?.endsWith('trends.js')) {
  const f = nextFormat();
  const t = await researchTrends(f);
  console.log(JSON.stringify(await pickTopic(t, f), null, 2));
}
