// Full Hindi history-documentary script (Forgotten Gathas): outline with documented key facts + a look bible for
// every historical figure → chapter by chapter (draft + documentary-editor pass) → length + banned-phrase sweeps →
// web fact-check (Groq browser_search) → packaging (title, description, tags, thumbnail) verified against the script.
import fs from 'node:fs';
import { aiJson, env, httpJson, log, parseJson } from './lib.js';
import { NARRATOR, bannedHits } from './script_writer.js';

const words = s => String(s).trim().split(/\s+/).filter(Boolean).length;
// Charon reads Hindi at ~180 words/min (dry run 2: 2,438 words = 13.5 min) → 3,000 words ≈ 17 min (owner: 15-20)
let TARGET = Number(env.TARGET_WORDS || 3000);

// visual: "ink" = a cinematic AI picture, "map" = animated map of a real place, "ui" = on-screen motion graphic
// (date card, big line, a document/letter/farman). Maps and UI cost no image quota.
const SCENE_SHAPE = `"scenes":[{"text":"Hindi narration in Devanagari for this beat, 2-4 short punchy sentences, 22-30 words (about 9 seconds; the edit cuts it into two shots)",
"visual":"ink" or "map" or "ui",
"prompt":"ink only, in ENGLISH: one clear cinematic film-still moment of this beat: who (name the historical figures
exactly as in the look bible), what they do, where, period costume/armour/architecture of that exact era and region,
light and mood; one main subject, wide or medium shot; no text, no gore",
"place":"map only: the real place in ENGLISH (e.g. 'Haldighati, Rajasthan, India')",
"ui":"ui only, one of {"type":"text","lines":["1-3 very short Hindi lines shown big, e.g. 18 जून 1576"]} |
{"type":"doc","title":"heading of a historical letter / treaty / farman, in Hindi","lines":["2-4 short lines"],"highlight":"key words"}"}]`;

function normScenes(d) {
  const scenes = (d.scenes || []).map(s => {
    let ui = s.ui && typeof s.ui === 'object' && s.ui.type ? s.ui : null;
    if (ui && !['text', 'doc'].includes(ui.type)) ui = null;
    const v = String(s.visual || '').toLowerCase();
    const visual = ui && v !== 'map' ? 'ui' : v.includes('map') && s.place ? 'map' : 'ink';
    return {
      text: String(s.text || s.narration || '').trim(), visual,
      prompt: String(s.prompt || s.image_prompt || '').trim(),
      place: visual === 'map' ? String(s.place) : null, ui: visual === 'ui' ? ui : null,
    };
  }).filter(s => s.text && (s.visual !== 'ink' || s.prompt));
  if (scenes.length < 3) throw new Error('too few scenes');
  return { ...d, scenes };
}

export async function outline(topic) {
  const minutes = Math.round(TARGET / 135);
  const chapters = Math.max(7, Math.round(TARGET / 300));
  const { data } = await aiJson(
    `${NARRATOR}\n\nPlan a ${minutes}-minute Hindi documentary on: ${topic.topic}\nHook angle: ${topic.angle}\n` +
    `A cold open in the middle of the decisive moment, then ${chapters} chapters that build tension (the world before, ` +
    `the people, the stakes, rising trouble, the turn, the climax, the aftermath, the forgotten detail), and an ending ` +
    `that pays off the opening. List only facts you are confident are documented.\n` +
    `Return JSON {"title_idea":"...","era":"period + region in ENGLISH (e.g. 16th-century Mewar, Rajasthan)",` +
    `"characters":[{"name":"name as used in the Hindi narration","role":"who they were","look":"in ENGLISH, fixed look ` +
    `for every picture, based on period paintings/descriptions: age, face, beard/moustache, build, turban/crown/helmet, ` +
    `armour or robes and colours, one detail (e.g. 36-year-old Rajput king, strong build, thick curled moustache, ` +
    `saffron turban with a pearl string, steel chainmail over a red angarkha)"}],` +
    `"cold_open":"the first 30 seconds","chapters":[{"name":"short Hindi chapter title","beats":["..."],` +
    `"key_facts":["specific documented fact with date/number"],"cliffhanger":"how it ends","mood":"music mood: suspense | war | epic | sad"}],"ending":"final image + last line idea"}`,
    { check: d => { if (!d.chapters?.length || !d.characters?.length) throw new Error('no chapters'); return d; }, temperature: 0.8 },
  );
  return data;
}

async function writeChapter(topic, plan, i, prevTail) {
  const ch = i < 0 ? { name: 'Cold open', beats: [plan.cold_open], key_facts: [], cliffhanger: '', mood: 'suspense' } : plan.chapters[i];
  const target = i < 0 ? 100 : Math.round(TARGET / plan.chapters.length);
  const isLast = i === plan.chapters.length - 1;
  const what = i < 0
    ? 'the COLD OPEN: start inside the decisive moment with one vivid concrete detail; no question as the first line; ' +
      'end on a line that makes leaving impossible'
    : `chapter "${ch.name}" (end it on: ${ch.cliffhanger || 'a turn that makes the listener stay'})`;
  const ask = `${NARRATOR}\n\nVideo: ${topic.topic}. Era: ${plan.era}. Look bible + plan: ${JSON.stringify(plan)}\n` +
    `Write ${what} in Hindi — about ${target} words, ${Math.max(3, Math.round(target / 26))} scenes. ` +
    `Most scenes are "ink" pictures. Add a "map" scene where a place, march or border matters (at most 2 per chapter) ` +
    `and a "ui" scene for a date, a number worth showing big, or a recorded letter/treaty (at most 2 per chapter). ` +
    `Picture prompts must name the historical figures exactly as in the look bible and match ${plan.era}. ` +
    (prevTail ? `It continues right after: "${prevTail}". Flow on naturally, don't recap. ` : '') +
    (isLast ? `This is the final chapter: land the ending (${plan.ending}), one line on why this gatha matters today, ` +
      `then one short line asking viewers which forgotten gatha we should tell next. ` : '') +
    `\nReturn JSON {${SCENE_SHAPE}}`;
  const draft = await aiJson(ask, { check: normScenes });
  const edited = await aiJson(
    `${NARRATOR}\n\nYou are the documentary's script editor. Make this Hindi gripping when heard aloud: sharper hooks, ` +
    `concrete sensory detail of the era, short lines at tense moments; cut filler, repeats and textbook tone; keep ` +
    `every fact, scene order, visuals, places, ui objects and picture prompts (fix names to match the look bible). ` +
    `No banned phrases.\nLOOK BIBLE: ${JSON.stringify(plan.characters)}\nDRAFT: ${JSON.stringify(draft.data)}\nReturn JSON {${SCENE_SHAPE}}`,
    { check: normScenes, temperature: 0.7 },
  );
  const mood = ['suspense', 'war', 'epic', 'sad'].includes(ch.mood) ? ch.mood : 'epic';
  return { name: ch.name, mood, scenes: edited.data.scenes, model: edited.model };
}

// Fact-check (2026-11-13): Google Search grounding is not free on our key (quota 0) and one Groq browser_search call
// costs ~31k tokens against an 8k tokens/minute limit, so a per-chapter check 429s. Instead: Gemini (plain) pulls the
// checkable claims (names, dates, numbers, places) out of the whole script → Groq gpt-oss + browser_search checks
// them in batches of ~25 with a 4-minute pause → only the wrong lines are rewritten. If Groq fails, Gemini reviews
// the claims from its own knowledge (weaker, but never skipped silently).
const sleep = ms => new Promise(x => setTimeout(x, ms));

async function extractClaims(chapters) {
  const lines = chapters.flatMap((c, ci) => c.scenes.map((s, si) => `[${ci}.${si}] ${s.text}`)).join('\n');
  const { data } = await aiJson(
    `From this Hindi history narration list every checkable factual claim (person, date/year, number, place, ` +
    `event, relation). Skip opinions, feelings and lines marked as legend.\n${lines}\n` +
    `Return JSON {"claims":[{"id":"chapter.scene","claim":"the claim restated in short ENGLISH"}]}`,
    { check: d => { if (!Array.isArray(d.claims)) throw new Error('no claims'); return d; }, temperature: 0.2 });
  return data.claims.filter(c => c.id && c.claim);
}

const CHECK_ASK = (claims, web) => `${web ? 'Use web search to verify' : 'From your knowledge of documented history, verify'} ` +
  `these claims from a Hindi history video about Indian history. Report ONLY the ones that are wrong or doubtful.\n` +
  claims.map(c => `[${c.id}] ${c.claim}`).join('\n') +
  `\n\nAnswer ONLY JSON: {"wrong":[{"id":"chapter.scene","correct":"the correct fact in English","why":"short reason"}]}`;

async function checkClaims(claims) {
  const out = []; let model = null;
  for (let k = 0; k < claims.length; k += 25) {
    const batch = claims.slice(k, k + 25);
    let done = false;
    for (const m of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
      for (let attempt = 0; attempt < 2 && !done; attempt++) {
        try {
          const d = await httpJson('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY}` },
            body: JSON.stringify({ model: m, temperature: 0.2, tools: [{ type: 'browser_search' }], messages: [{ role: 'user', content: CHECK_ASK(batch, true) }] }),
          }, { tries: 1, timeoutMs: 180000 });
          const j = parseJson(d.choices?.[0]?.message?.content || '');
          out.push(...(Array.isArray(j.wrong) ? j.wrong : [])); model = m; done = true;
        } catch (e) {
          log('fact-check', m, 'failed:', e.message.slice(0, 100));
          if (/429/.test(e.message)) await sleep(70000);
        }
      }
      if (done) break;
    }
    if (!done) {
      const r = await aiJson(CHECK_ASK(batch, false), { check: d => { if (!Array.isArray(d.wrong)) throw new Error('no list'); return d; }, temperature: 0.2 }).catch(() => null);
      if (r) { out.push(...r.data.wrong); model = model || `${r.model} (no web)`; }
    }
    if (k + 25 < claims.length) await sleep(240000);   // 8k tokens/minute vs ~31k per search call
  }
  return { model, wrong: out };
}

async function factCheck(chapters) {
  const claims = await extractClaims(chapters);
  log('fact-check:', claims.length, 'claims');
  const r = await checkClaims(claims);
  return { model: r.model, fixes: r.wrong.map(w => ({ id: w.id, text: w.correct, why: w.why })) };
}

// cacheFile: outline + finished chapters are saved as they're made, so a restart continues instead of starting over
export async function writeLongScript(topic, cacheFile, ctx = {}) {
  TARGET = Number(ctx.words || env.TARGET_WORDS || 3000);
  const cache = (() => { try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { return {}; } })();
  const keep = () => cacheFile && fs.writeFileSync(cacheFile, JSON.stringify(cache));
  log('look bible + outline…');
  const plan = cache.plan || (cache.plan = await outline(topic));
  keep();
  const chapters = cache.chapters || (cache.chapters = []);
  let tail = chapters.at(-1)?.scenes.at(-1).text || '';
  for (let i = chapters.length - 1; i < plan.chapters.length; i++) {
    const c = await writeChapter(topic, plan, i, tail);
    chapters.push(c); keep();
    tail = c.scenes.at(-1).text;
    log(`chapter ${i + 1}/${plan.chapters.length}: ${c.name} (${words(c.scenes.map(s => s.text).join(' '))} words, ` +
      `${c.scenes.filter(s => s.visual === 'map').length} map, ${c.scenes.filter(s => s.visual === 'ui').length} ui, ${c.model})`);
  }
  // too short? add real scenes to the thinnest chapters
  for (let pass = 0; pass < 5; pass++) {
    const total = words(chapters.flatMap(c => c.scenes.map(s => s.text)).join(' '));
    if (total >= TARGET * 0.9) break;
    const ci = chapters.map((c, k) => [k, words(c.scenes.map(s => s.text).join(' '))]).filter(([k]) => k > 0)
      .sort((a, b) => a[1] - b[1])[0][0];
    const c = chapters[ci];
    log(`script ${total} words < ${Math.round(TARGET * 0.9)} → adding scenes to "${c.name}"`);
    const need = Math.min(6, Math.max(3, Math.round((TARGET - total) / 26 / 2)));
    const r = await aiJson(`${NARRATOR}\n\nVideo: ${topic.topic}. Era: ${plan.era}. Look bible: ${JSON.stringify(plan.characters)}\n` +
      `This chapter is too thin:\n${JSON.stringify(c.scenes.map(s => s.text))}\nWrite ${need} NEW Hindi scenes ` +
      `(22-30 words each) with more documented detail — what people did, the place, the stakes, a telling fact — that ` +
      `fit after one of these lines. Don't repeat anything. ` +
      `Return JSON {"after_scene": index of the existing scene they follow (0-based), ${SCENE_SHAPE}}`,
      { check: normScenes, temperature: 0.7 }).catch(() => null);
    if (!r) break;
    const at = Math.min(c.scenes.length - 1, Math.max(0, Number(r.data.after_scene ?? c.scenes.length - 1)));
    c.scenes.splice(at + 1, 0, ...r.data.scenes);
  }
  keep();

  // banned phrases: rewrite only the offending scenes
  for (const c of chapters) {
    for (const s of c.scenes) {
      const hits = bannedHits(s.text);
      if (!hits.length) continue;
      const r = await aiJson(`Rewrite this Hindi narration line without the phrases ${hits.join(', ')}, same voice and facts. ` +
        `Line: "${s.text}"\nReturn JSON {"text":"..."}`, { check: d => { if (!d.text) throw new Error('empty'); return d; } }).catch(() => null);
      if (r) s.text = r.data.text;
    }
  }

  // repeated rhetorical-question openers / stock images: keep the first 3, rewrite the rest as statements
  const qs = chapters.slice(1).flatMap(c => c.scenes).filter(x => /\bक्या\b[^।?]*\?/.test(x.text) || /\?$/.test(x.text.trim()));
  for (const x of qs.slice(3)) {
    const r = await aiJson(`${NARRATOR}\nRewrite this Hindi narration line as a strong statement (no question), same ` +
      `facts and voice: "${x.text}"\nReturn JSON {"text":"..."}`, { check: d => { if (!d.text) throw new Error('empty'); return d; } }).catch(() => null);
    if (r) x.text = r.data.text;
  }
  // fact-check, then put each correction back into the narrator's own voice
  if (!cache.factChecked) {
    log('fact-check…');
    const fc = await factCheck(chapters);
    const clean = t => String(t).replace(/【[^】]*】/g, '').replace(/\s{2,}/g, ' ').trim();
    for (const f of fc.fixes) {
      const [ci, si] = String(f.id).split('.').map(Number);
      const sc = chapters[ci]?.scenes[si];
      if (!sc || !f.text) continue;
      try {
        const r = await aiJson(`${NARRATOR}\nThis Hindi narration line has a factual error.\nLine: "${sc.text}"\n` +
          `Correct fact: ${clean(f.why)} ${clean(f.text)}\nRewrite the line as natural spoken Hindi narration with the ` +
          `correct fact (or drop the doubtful claim). No sources, no brackets. Return JSON {"text":"..."}`,
          { check: d => { if (!d.text) throw new Error('empty'); return d; }, temperature: 0.5 });
        sc.text = clean(r.data.text); sc.factFixed = clean(f.why);
      } catch { /* keep the original line rather than a footnote-style fix */ }
    }
    cache.factChecked = { model: fc.model, fixes: fc.fixes.length }; keep();
    log('fact-check by', fc.model, 'fixes', fc.fixes.length);
  }

  const all = chapters.flatMap(c => c.scenes.map(s => s.text)).join(' ');
  const { data: pack } = await aiJson(
    `${NARRATOR}\n\nPackage this Hindi history documentary for YouTube India. Planned title idea: "${topic.title || plan.title_idea}" ` +
    `(it must stay our own wording; never a competitor's title). Look bible: ${JSON.stringify(plan.characters)}\n` +
    `Script: ${all.slice(0, 7000)}\n` +
    `Return JSON {"title":"max 80 chars, Hindi in Devanagari, honest curiosity hook about what really happened, at most ` +
    `one emoji","thumb_text":"2-4 big Hindi words for the thumbnail, different from the title","thumb_prompt":"in ENGLISH: ` +
    `thumbnail picture: the most dramatic moment, ONE named figure (with the look bible look) large on the RIGHT half, ` +
    `face and emotion clear, epic light, the LEFT 40% simple and darker for big text, no text, no gore",` +
    `"description":"2 short paragraphs in Hindi about the video without spoiling the ending, then one line inviting ` +
    `viewers to comment which gatha we should tell next","tags":["12-15 tags, Hindi and English (e.g. इतिहास, ` +
    `history in hindi, indian history, the main names and places)"]}`,
    { check: d => { if (!d.title || !d.description) throw new Error('no package'); return d; } },
  );
  await verifyPack(pack, all);
  pack.category = 'history';
  return { topic, plan, chapters, pack, words: words(all), banned_left: bannedHits(all), ctx: { cat: 'history' } };
}

// Misleading titles hurt trust and the channel, so title + thumbnail text must be supported by the script and history.
export async function verifyPack(pack, script) {
  const { data } = await aiJson(
    `Script of a Hindi history video:\n${script.slice(0, 9000)}\n\nProposed YouTube title: "${pack.title}"\nThumbnail text: "${pack.thumb_text}"\n` +
    `Check every claim in the title and thumbnail text against the script and real history. Curiosity is fine, ` +
    `invented or exaggerated events are not. Return JSON {"title_ok":true/false,"thumb_ok":true/false,` +
    `"title":"the same title if ok, else an honest curiosity title in Hindi (Devanagari) max 80 chars","thumb_text":"same if ok, else 2-4 honest Hindi words","why":"short"}`,
    { check: d => { if (!d.title) throw new Error('no verdict'); return d; }, temperature: 0.3 },
  );
  if (!data.title_ok) { log('title fixed:', pack.title, '→', data.title, `(${data.why})`); pack.title = data.title; }
  if (!data.thumb_ok && data.thumb_text) { log('thumb text fixed:', pack.thumb_text, '→', data.thumb_text); pack.thumb_text = data.thumb_text; }
  return pack;
}
