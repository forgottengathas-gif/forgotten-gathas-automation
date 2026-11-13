// Spoken Hindi numbers (owner 2026-11-13): years are said the Hindi way in pairs — 1910 = "उन्नीस सौ दस",
// 1576 = "पंद्रह सौ छिहत्तर", never "एक हज़ार नौ सौ दस". The script writes numbers as digits; this turns them into
// the words the TTS should say. Other numbers use हज़ार / लाख / करोड़.
const U = ('शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस ' +
  'इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस ' +
  'सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास ' +
  'इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ ' +
  'अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी ' +
  'बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पचानवे छियानवे ' +
  'सत्तानवे अट्ठानवे निन्यानवे').split(' ');

export function numHi(n) {
  n = Math.floor(Number(n));
  if (n < 100) return U[n];
  const parts = [];
  const take = (div, word) => { const q = Math.floor(n / div); if (q) { parts.push(`${numHi(q)} ${word}`); n %= div; } };
  take(1e7, 'करोड़'); take(1e5, 'लाख'); take(1e3, 'हज़ार'); take(100, 'सौ');
  if (n) parts.push(U[n]);
  return parts.join(' ');
}

// years: 1100-1999 → "<hundreds> सौ <rest>" in pairs; 2000-2099 → "दो हज़ार <rest>"; below 1000 as a normal number
export function yearHi(y) {
  y = Number(y);
  if (y >= 1100 && y < 2000) { const h = Math.floor(y / 100), r = y % 100; return `${U[h]} सौ${r ? ' ' + U[r] : ''}`; }
  if (y >= 1000 && y < 1100) { const r = y % 100; return `एक हज़ार${r ? ' ' + U[r] : ''}`; }
  return numHi(y);
}

// Narration text → TTS text: digits become spoken Hindi. A 3-4 digit number is read as a year when "सन"/"ईस्वी"/
// "ई." / "में" / "AD/BC" / "ईसा" sits next to it or it lies in 1100-2099; "1,20,000" and "40000" stay amounts.
export function spokenHindi(text) {
  return String(text)
    .replace(/(\d{1,3}(?:,\d{2,3})+)/g, m => numHi(m.replace(/,/g, '')))
    .replace(/(\d+)\s*(?:-|–|से)\s*(\d+)/g, (m, a, b) => `${conv(a, true)} से ${conv(b, true)}`)
    .replace(/(सन\s*)?(\d+)(\s*(?:ईस्वी|ई\.|AD|BC|ईसा|में|के|की|का))?/g, (m, sn, d, after) => `${sn || ''}${conv(d, !!(sn || after))}${after || ''}`);
}
function conv(d, hint) {
  const n = Number(d);
  if (d.length >= 3 && d.length <= 4 && (hint || (n >= 1100 && n < 2100)) && n >= 300 && n < 2100) return yearHi(n);
  return numHi(n);
}

if (process.argv[1]?.endsWith('hindi_numbers.js')) {
  for (const t of ['सन 1910 में', '1576 का युद्ध', 'सन 1010 ईस्वी', '712 ई. में', '40000 सैनिक', '1,20,000 लोग', '1857-1858', 'सन 2001', '427 से 1200 तक'])
    console.log(t, '→', spokenHindi(t));
}
