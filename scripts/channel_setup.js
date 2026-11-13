// One-time YouTube channel setup (Forgotten Gathas) for reach (owner 2026-11-12: profiles set so videos get recommended to
// non-subscribers): description, keywords, country, default language, not made for kids, upload defaults.
import { api } from './yt.js';
import { env, log } from './lib.js';

const ch = (await api('channels?part=brandingSettings,status&mine=true')).items[0];
const b = ch.brandingSettings || {};
b.channel = {
  ...b.channel,
  description: 'Forgotten Gathas — इतिहास की भूली हुई गाथाएँ।\n\n' +
    'महान योद्धा, राजवंश, युद्ध और रहस्य — भारत के इतिहास की वे गाथाएँ जिन्हें दुनिया भूल गई, फ़िल्म जैसी हिंदी डॉक्यूमेंट्री में। ' +
    'हर वीडियो ऐतिहासिक स्रोतों पर आधारित; जहाँ इतिहासकारों में मतभेद है, वहाँ बताया जाता है।\n\n' +
    'हर दिन एक नई गाथा + Shorts।\nFacebook: Forgotten Gathas · Instagram: @forgottengathas\n\n' +
    'दृश्य AI से बने कलात्मक पुनर्निर्माण हैं, असली तस्वीरें नहीं।',
  keywords: '"indian history" "history in hindi" "इतिहास" "भारत का इतिहास" "hindi documentary" "महान योद्धा" ' +
    '"ancient india" "mughal history" "rajput history" "maratha history" "forgotten gathas"',
  country: 'IN',
  defaultLanguage: 'hi',
};
await api('channels?part=brandingSettings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ch.id, brandingSettings: b }) });
await api('channels?part=status', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ch.id, status: { selfDeclaredMadeForKids: false } }) }).catch(e => log('kids flag:', e.message.slice(0, 120)));
const after = (await api(`channels?part=brandingSettings,status&id=${ch.id}`)).items[0];
log('channel', ch.id, '| country', after.brandingSettings.channel.country, '| lang', after.brandingSettings.channel.defaultLanguage,
  '| keywords', (after.brandingSettings.channel.keywords || '').length, 'chars | madeForKids', after.status?.madeForKids);
