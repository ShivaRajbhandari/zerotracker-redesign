/* Net Zero Tracker redesign prototype — single-page app (hash routing) */
(function(){
'use strict';
const D = window.NZT, META = window.NZT_META || {};
const NOW = 2026;
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n.toLocaleString('en-US');
const pct = (a,b) => b ? Math.round(100*a/b) : 0;
D.forEach(e => { if (e.c === 'EUU') { e.a2 = 'EU'; e.g = 'Europe'; } });  // the EU has no country code or region of its own, so give it the EU flag and list it under Europe
const BY = Object.fromEntries(D.map(e => [e.s, e]));
D.forEach(e => { if (e.rev >= 1e12) { e.revBad = e.rev; delete e.rev; } }); // data issue in the source: see the notes page
const THE = /^(United |Netherlands|Philippines|Bahamas|Gambia|Maldives|Marshall Islands|Solomon Islands|Comoros|Seychelles|Czech Republic|Dominican Republic|Central African Republic|Dem\. Rep\.|Republic of|European Union)/;
const SHORT_NAME = {'Venezuela, Bolivarian Republic of':'Venezuela', 'Iran, Islamic Republic of':'Iran', 'Moldova, Republic of':'Moldova', 'Macedonia, the former Yugoslav Republic of':'North Macedonia', 'Palestinian Territory, Occupied':'Palestine', 'Russian Federation':'Russia', 'Syrian Arab Republic':'Syria', 'Brunei Darussalam':'Brunei'};
const CN_SHORT = {'Viet Nam':'Vietnam', 'Korea, Republic of':'South Korea', 'Russian Federation':'Russia', 'Taiwan, Province of China':'Taiwan', 'Congo, Democratic Republic of the':'DR Congo', 'Micronesia (Federated States of)':'Micronesia', "Lao People's Democratic Republic":'Laos', 'Bolivia (Plurinational State of)':'Bolivia', 'Brunei Darussalam':'Brunei', 'Iran (Islamic Republic of)':'Iran', 'Moldova, Republic of':'Moldova', "Korea (Democratic People's Republic of)":'North Korea', 'Palestine, State of':'Palestine', 'Syrian Arab Republic':'Syria', 'Tanzania, United Republic of':'Tanzania', 'Venezuela (Bolivarian Republic of)':'Venezuela'};
// governments' formal names are kept only in the page title (e.on); everywhere else the everyday name is used
D.forEach(e => { if (e.t === 'country' && SHORT_NAME[e.n]) { e.on = e.n; e.n = SHORT_NAME[e.n]; } if (e.cn && CN_SHORT[e.cn]) e.cn = CN_SHORT[e.cn]; });
const plainName = e => e.n;
const nm = e => (e.t === 'country' && THE.test(e.n) ? 'the ' : '') + plainName(e);
const Nm = e => { const s = nm(e); return s[0].toUpperCase() + s.slice(1); };

/* ---------- vocabulary: plain language ---------- */
const NZ_TYPES = new Set(['Net zero','Carbon neutral(ity)','Climate neutral','GHG neutral(ity)','Zero emissions','Zero carbon','Net negative','Carbon negative','Climate positive']);
const isNZ = e => NZ_TYPES.has(e.e);
const hasAnyTarget = e => e.e && e.e !== 'No target';
const year = e => { const y = +e.y; return y >= 2000 ? y : null; };
const iyear = e => { const y = +e.iy; return y >= 2000 ? y : null; };
const TYPE = {country:['Country','Countries'], region:['Region','Regions'], city:['City','Cities'], company:['Company','Companies']};
// what each country calls its first-level divisions: [singular, plural, word added after the name]
const REG_TERM = {USA:['state','states'], AUS:['state','states'], IND:['state','states'], MEX:['state','states'], BRA:['state','states'], DEU:['state','states'], MYS:['state','states'],
  CAN:['province','provinces'], ZAF:['province','provinces'], CHN:['province','provinces'], KOR:['province','provinces'], IDN:['province','provinces'], TUR:['province','provinces'], THA:['province','provinces'], IRN:['province','provinces'],
  JPN:['prefecture','prefectures'], TWN:['county','counties'], ESP:['autonomous community','autonomous communities','region'], POL:['voivodeship','voivodeships']};
const REG_NAME = {'Yukon':['territory','territories'], 'Northwest Territories':['territory','territories'], 'Nunavut':['territory','territories'], 'Northern Territory':['territory','territories'], 'Australian Capital Territory':['territory','territories'],
  'Guangxi':['autonomous region','autonomous regions','region'], 'Inner Mongolia':['autonomous region','autonomous regions','region'], 'Ningxia':['autonomous region','autonomous regions','region'], 'Xinjiang Uygur':['autonomous region','autonomous regions','region'], 'Xizang':['autonomous region','autonomous regions','region']};
const regTerm = e => REG_NAME[e.n] || REG_TERM[e.c] || ['region', 'regions'];
const capW = w => w.charAt(0).toUpperCase() + w.slice(1);
const typeWord = e => e.t === 'region' ? capW(regTerm(e)[0]) : TYPE[e.t][0];
const typePlural = e => e.t === 'region' ? capW(regTerm(e)[1]) : TYPE[e.t][1];
const placeName = e => { if (e.t !== 'region') return e.n; const t = regTerm(e), w = t[2] || t[0]; return new RegExp(w + '|' + t[0] + '|district|metropolis|capital|city|community', 'i').test(e.n) ? e.n : e.n + ' ' + w; };
const TYPE_PATH = {country:'countries', region:'regions', city:'cities', company:'companies'};

// commitment strength ladder
const LADDER = [
  {k:1, raw:['Proposed / in discussion'], label:'Being discussed', plain:'Proposed, not yet adopted', col:'var(--s1)', hex:'#dcebcf'},
  {k:2, raw:['Declaration / pledge'], label:'Announced', plain:'A public promise or pledge', col:'var(--s2)', hex:'#b2d49b'},
  {k:3, raw:['In policy document','In corporate strategy'], label:'In an official plan', plain:'Written into policy or company strategy', col:'var(--s3)', hex:'#7db165'},
  {k:4, raw:['In law'], label:'Legally binding', plain:'Written into law', col:'var(--s4)', hex:'#4a8a3c'},
  {k:5, raw:['Achieved (self-declared)','Achieved (externally validated)'], label:'Claims achieved', plain:'Says it has reached the target', col:'var(--s5)', hex:'#24572a'},
];
const NONE = {k:0, label:'No net zero target', plain:'No net zero target found', col:'var(--s0)', hex:'#c9c7cc'};
const OTHER = {k:-1, label:'Other climate target', plain:'Has a climate target, but not net zero', col:'var(--s-other)', hex:'#e6d6bd'};
function level(e){
  if (!isNZ(e)) return hasAnyTarget(e) ? OTHER : NONE;
  return LADDER.find(l => l.raw.includes(e.st)) || {k:0.5, label:'Status unclear', plain:'Target found, status unclear', col:'#e9e7ec', hex:'#e9e7ec'};
}
const targetWord = e => {
  const t = e.e;
  if (!t || t === 'No target') return 'No target';
  if (t === 'Carbon neutral(ity)') return 'Carbon neutral';
  if (t === 'GHG neutral(ity)') return 'Greenhouse-gas neutral';
  if (t === 'Reduction v. BAU') return 'Cut vs. business-as-usual';
  return t;
};
const targetPhrase = e => {
  const y = year(e);
  if (!hasAnyTarget(e)) return 'No target';
  if (isNZ(e)) return `${targetWord(e)}${y ? ' by ' + y : ''}`;
  if (e.ep) return `${e.ep}% cut${y ? ' by ' + y : ''}${e.eb ? ' (vs ' + e.eb + ')' : ''}`;
  return `${targetWord(e)}${y ? ' by ' + y : ''}`;
};

/* ---------- credibility checklist (prototype summary of NZT indicators) ---------- */
const PILLARS = [
  {id:'target', name:'Is it a real target?', short:'Target', col:'#3B7CC3'},
  {id:'cover', name:'Does it cover all emissions?', short:'Coverage', col:'#7D7089'},
  {id:'gov', name:'Is there a plan & accountability?', short:'Plan & governance', col:'#A5865C'},
  {id:'off', name:'Is it real cuts, not just offsets?', short:'Offsets & removals', col:'#5EA845'},
];
const gov = e => e.t !== 'company';
function checks(e){
  const L = level(e), out = [];
  const add = (p, id, q, v, a, why) => out.push({p, id, q, v, a, why});
  // TARGET
  if (e.t === 'company') {
    add('target','lock','Is the target formally adopted?', L.k>=3 ? 'yes' : L.k>=1 ? 'part' : 'no',
      L.k>=5 ? 'The company says it has already met it.' : L.k>=3 ? 'Yes. It is part of official company strategy.' : L.k>=1 ? `Only partly: it is at the "${L.label.toLowerCase()}" stage.` : 'No net zero target found.',
      'A target in official strategy is harder to quietly drop than a press-release pledge.');
  } else {
    add('target','lock','Is the target locked in by law or policy?', L.k>=4 ? 'yes' : L.k>=3 ? 'part' : 'no',
      L.k===5 ? 'It says it has already reached the target.' : L.k===4 ? 'Yes. It is written into law.' : L.k===3 ? 'Partly. It is in a policy document but not in law.' : L.k>=1 ? `No. It is only at the "${L.label.toLowerCase()}" stage.` : 'No net zero target found.',
      'Targets in law survive changes of government and can be enforced. Pledges and policy papers can be dropped.');
  }
  const iy = iyear(e), hasI = e.it && e.it !== 'No target';
  const passed = hasI && iy && iy < NOW;
  add('target','interim','Is there a near-term milestone?', hasI && iy && iy <= 2035 && !passed ? 'yes' : hasI ? 'part' : (e.it ? 'no' : 'unk'),
    hasI ? `${e.ip ? e.ip + '% cut' : (e.it === 'Net zero or similar' ? 'Net zero' : 'A reduction target')}${iy ? ' by ' + iy : ''}${e.ib ? ' (vs ' + e.ib + ')' : ''}.${passed ? ' That year has passed and no newer milestone is recorded.' : iy && iy > 2035 ? ' That is still more than ten years away.' : ''}` : (e.it ? 'No interim target. Only a distant end date.' : 'Not assessed.'),
    'A milestone within about 5 to 10 years shows whether cuts are actually starting now, not after current leaders have left.');
  // COVERAGE
  add('cover','gas','Does it cover all greenhouse gases?', e.gas === 'Carbon dioxide and other GHGs' ? 'yes' : e.gas === 'Carbon dioxide only' ? 'part' : 'unk',
    e.gas === 'Carbon dioxide and other GHGs' ? 'Yes. CO₂ and other gases such as methane.' : e.gas === 'Carbon dioxide only' ? 'CO₂ only. Methane and other gases are left out.' : 'Not specified.',
    'Methane alone is responsible for about 30% of global warming so far. A CO₂-only target leaves it out.');
  if (e.t === 'company') {
    add('cover','s3','Does it include its supply chain and products (Scope 3)?', {Yes:'yes',Partial:'part',No:'no'}[e.s3] || 'unk',
      {Yes:'Yes. It covers emissions across its value chain.',Partial:'Partly. Only some value-chain emissions are covered.',No:'No. It only covers its own operations and energy use.'}[e.s3] || 'Not specified.',
      'For most companies, most emissions come from suppliers and from customers using their products (Scope 3). Leaving them out can drop most of the footprint.');
  } else {
    add('cover','cons','Does it count emissions from imported goods?', {Yes:'yes',No:'no'}[e.cons] || 'unk',
      {Yes:'Yes. It counts consumption-based emissions.',No:'No. It counts only emissions produced inside its borders.'}[e.cons] || 'Not specified.',
      'Places that import most of their goods can look cleaner than they are if they count only emissions inside their borders.');
  }
  // GOVERNANCE
  add('gov','plan','Is there a published plan to get there?', e.plan === 'Yes' ? (e.po >= 4 ? 'yes' : 'part') : e.plan === 'No' ? 'no' : 'unk',
    e.plan === 'Yes' ? (e.po >= 4 ? 'Yes. It sets out measures, expected cuts, scale and a review schedule.' : `A partial plan, with ${e.po || 0} of the 4 elements we look for.`) : e.plan === 'No' ? 'No detailed plan found.' : 'Not assessed.',
    'We look for 4 elements: measures for every emission source, how much each measure will cut, how far it will be applied, and a schedule for review.');
  add('gov','rep','Does it report progress every year?', {'Annual reporting':'yes','Less than annual reporting':'part','No reporting mechanism':'no'}[e.rep] || 'unk',
    {'Annual reporting':'Yes. It reports every year.','Less than annual reporting':'Less often than once a year.','No reporting mechanism':'No reporting mechanism found.'}[e.rep] || 'Not assessed.',
    'Without regular reporting, nobody can check whether emissions are actually falling.');
  if (gov(e)) add('gov','acc','Is someone formally accountable?', {Yes:'yes',No:'no'}[e.acc] || 'unk',
    {Yes:'Yes. A body or official is responsible for delivery.',No:'No formal accountability found.'}[e.acc] || 'Not specified.',
    'Named responsibility, such as an independent climate council or a minister, makes it possible to hold someone to the target.');
  // OFFSETS
  const strongCond = e.cond && /integrity|social|biodiversity/i.test(e.cond);
  add('off','offsets','Does it avoid relying on carbon offsets?', e.off === 'No' ? 'yes' : e.off === 'Yes' ? (strongCond ? 'part' : 'no') : 'unk',
    e.off === 'No' ? 'Yes. It does not plan to use offset credits.' : e.off === 'Yes' ? (strongCond ? 'It plans to use offsets, with quality conditions.' : 'It plans to use offsets, with no quality conditions stated.') : 'Not specified.',
    'Offsets pay someone else to cut or absorb carbon. Many have turned out to deliver far less than claimed. Good practice is to cut your own emissions first.');
  add('off','rem','Does it keep cuts and removals separate?', {Yes:'yes',No:'no'}[e.rem] || 'unk',
    {Yes:'Yes. It sets separate goals for cutting emissions and for removing carbon.',No:'No. Cuts and removals are lumped together.'}[e.rem] || 'Not assessed.',
    'Separate goals stop promised future tree-planting or carbon capture from replacing real cuts today.');
  return out;
}
const tally = cs => cs.reduce((t,c) => (t[c.v]++, t), {yes:0,part:0,no:0,unk:0});

/* ---------- icons ---------- */
const ICON = {
  yes:'<svg class="ck v-yes" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7 12.5l3.2 3.2L17.5 8.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  part:'<svg class="ck v-part" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/></svg>',
  no:'<svg class="ck v-no" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>',
  unk:'<svg class="ck v-unk" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fff" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.4"/><text x="12" y="16.5" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor" font-family="sans-serif">?</text></svg>',
};
const VLAB = {yes:'Yes', part:'Partly', no:'No', unk:'Unknown'};
const vtag = v => `${ICON[v]}<span class="sr">${VLAB[v]}</span>`;
const MAG = '<svg class="mag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21" stroke-linecap="round"/></svg>';
const flag = a2 => a2 && a2.length===2 ? String.fromCodePoint(...[...a2.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '';
const pill = e => { const L = level(e); return `<span class="pill"><i style="background:${L.hex}"></i>${esc(L.label)}</span>`; };
const typeBadge = (t, e) => `<span class="badge ${t}">${e && t === 'region' ? capW(regTerm(e)[0]) : TYPE[t][0]}</span>`;
const where = e => e.t === 'country' ? (e.g || '') : [e.cn, e.t==='company' && e.sec ? e.sec : null].filter(Boolean).join(' · ');
const official = e => `https://zerotracker.net/${TYPE_PATH[e.t]}/${e.s}`;
const money = n => n >= 1e12 ? '$' + (n/1e12).toFixed(1) + 'tn' : n >= 1e9 ? '$' + Math.round(n/1e9) + 'bn' : n >= 1e6 ? '$' + Math.round(n/1e6) + 'm' : '$' + fmt(n);
const people = n => n >= 1e9 ? (n/1e9).toFixed(2) + ' billion' : n >= 1e6 ? (n/1e6).toFixed(1) + ' million' : fmt(Math.round(n));

/* ---------- helpers ---------- */
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 2200); }
function copy(text){ (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Copied to clipboard'), () => toast('Select and copy the text manually')); }
(function(){ const m = $('#more'); if (!m) return; const b = $('.more-btn', m);
  b.onclick = ev => { ev.stopPropagation(); m.classList.toggle('open'); b.setAttribute('aria-expanded', m.classList.contains('open')); };
  document.addEventListener('click', ev => { if (!m.contains(ev.target)) { m.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); } });
  addEventListener('hashchange', () => { m.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') m.classList.remove('open'); }); })();
window.toggleMenu = btn => { const n = $('#nav'); n.classList.toggle('open'); btn.setAttribute('aria-expanded', n.classList.contains('open')); };
const tip = $('#tip');
function showTip(html, ev){ tip.innerHTML = html; tip.style.display = 'block'; moveTip(ev); }
function moveTip(ev){ const w = tip.offsetWidth, h = tip.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
function hideTip(){ tip.style.display = 'none'; }
// phones have no hover: a tap on a chart's hover area shows the same readout, and scrolling hides it
document.addEventListener('pointerdown', ev => { if (ev.pointerType === 'mouse') return; const t = ev.target; if (t && t.id && /-hit$/.test(t.id)) t.dispatchEvent(new MouseEvent('mousemove', {clientX: ev.clientX, clientY: ev.clientY, bubbles: true})); }, true);
addEventListener('scroll', () => { if (matchMedia('(hover: none)').matches) hideTip(); }, {passive: true});
// per-person emissions: countries use each year's population (Our World in Data), regions and cities today's population
const EPC = {on: false};
function loadPop(){ return window.NZPOP ? Promise.resolve(window.NZPOP) : new Promise(res => { const t = document.createElement('script'); t.src = 'pop.js?v=20261121a'; t.onload = () => res(window.NZPOP); t.onerror = () => res(null); document.head.appendChild(t); }); }
function hasPop(e){ return e.t === 'country' || (e.t !== 'company' && +e.pop > 0); }
function popAt(e, yr){ if (e.t === 'country') { const P = (window.NZPOP || {})[e.s]; if (!P) return null; const v = P[1][yr - P[0]]; return v ? v * 1e3 : null; } return +e.pop > 0 ? +e.pop : null; }
function viewSeries(e, pc){
  const se = emisSeries(e); if (!se || !pc || e.t === 'company') return se;
  const v = se.v.map((m, i) => { if (m == null) return null; const q = popAt(e, se.y0 + i); return q ? m * 1e6 / q : null; });
  let a = 0; while (a < v.length && v[a] == null) a++;
  return a < v.length ? {...se, y0: se.y0 + a, v: v.slice(a), pc: true} : null;
}
// charts are drawn at the width they are shown at, so their text stays readable on a phone
function chartW(){ const m = document.getElementById('main'), w = (m && m.clientWidth) || innerWidth; return Math.max(340, Math.min(900, Math.round(w - 56))); }
// on a phone a tap on the map or a company box opens a small card instead of going straight to the profile
function placeCard(box, e){
  if (!box || !e) return; let c = box.querySelector('.mapcard');
  if (!c) { c = document.createElement('div'); c.className = 'mapcard'; box.appendChild(c); }
  c.innerHTML = `<button class="x" aria-label="Close">×</button><div>${tipHtml(e).replace(/<br><span class="k" style="font-size:12.5px">Click for the full profile<\/span>/, '')}</div><a class="btn btn-purple btn-sm" href="#/e/${e.s}">Open profile →</a>`;
  c.hidden = false; c.querySelector('.x').onclick = ev => { ev.stopPropagation(); c.hidden = true; };
}
const compareSet = { get(){ try { return JSON.parse(localStorage.getItem('nzt-cmp') || '[]').filter(s => BY[s]); } catch(e) { return this._m || []; } },
  set(a){ this._m = a; try { localStorage.setItem('nzt-cmp', JSON.stringify(a)); } catch(e){} } };

/* ---------- search box ---------- */
/* brands and subsidiaries that should find their parent company */
const ALIAS_SRC = [
 [/^Alphabet$/, 'google, youtube, android, waymo, gmail, chrome, deepmind, fitbit, nest'],
 [/^Meta Platforms/, 'facebook, instagram, whatsapp, messenger, oculus, threads'],
 [/^Amazon$/, 'aws, amazon web services, whole foods, twitch, audible, prime video, zappos, kindle'],
 [/^Microsoft$/, 'linkedin, github, xbox, azure, skype, minecraft, bing, activision, windows, office'],
 [/^Apple$/, 'iphone, ipad, macbook, itunes, beats'],
 [/^Volkswagen$/, 'audi, porsche, skoda, seat, cupra, bentley, lamborghini, bugatti, scania, man trucks'],
 [/^BMW/, 'mini, rolls-royce'],
 [/^Mercedes-Benz/, 'mercedes, smart, maybach'],
 [/^Daimler Truck/, 'freightliner, western star, mercedes trucks'],
 [/^Toyota Motor/, 'lexus, daihatsu, hino'],
 [/^Honda Motor/, 'acura'],
 [/^Nissan Motor/, 'infiniti, datsun'],
 [/^Hyundai Motor/, 'genesis'],
 [/^Tata Motors/, 'jaguar, land rover, jlr, range rover'],
 [/^Stellantis/, 'fiat, chrysler, jeep, dodge, ram, peugeot, citroen, citroën, opel, vauxhall, maserati, alfa romeo'],
 [/^Renault/, 'dacia, alpine'],
 [/^General Motors/, 'chevrolet, gmc, cadillac, buick, cruise'],
 [/^Ford Motor/, 'lincoln'],
 [/^Nestl/, 'nespresso, purina, kitkat, nescafe, nescafé, perrier, san pellegrino, gerber, maggi'],
 [/^Unilever/, 'dove, lipton, ben & jerry, hellmann, knorr, magnum, axe, lux, vaseline'],
 [/^Procter/, 'gillette, pampers, tide, ariel, oral-b, head & shoulders, old spice, p&g'],
 [/^Coca-Cola Company/, 'coke, fanta, sprite, costa, minute maid, dasani, powerade'],
 [/^PepsiCo/, 'pepsi, frito-lay, gatorade, quaker, lays, doritos, mountain dew, tropicana'],
 [/^Walmart/, 'sam\'s club, asda, flipkart, walmart de mexico'],
 [/^Walt Disney/, 'disney, espn, pixar, marvel, hulu, lucasfilm, abc, national geographic'],
 [/^Comcast/, 'nbcuniversal, nbc, sky, universal, xfinity, peacock'],
 [/^Anheuser/, 'budweiser, corona, stella artois, michelob, ab inbev'],
 [/^Diageo/, 'guinness, johnnie walker, smirnoff, baileys, tanqueray'],
 [/^Kraft Heinz/, 'heinz, kraft, oscar mayer'],
 [/^Mondelez/, 'oreo, cadbury, toblerone, milka'],
 [/^Inditex/, 'zara, massimo dutti, bershka, pull&bear, stradivarius'],
 [/^LVMH/, 'louis vuitton, dior, moet, moët, hennessy, tiffany, sephora, bulgari, fendi, celine'],
 [/^Kering/, 'gucci, saint laurent, balenciaga, bottega veneta'],
 [/^Richemont/, 'cartier, van cleef, piaget'],
 [/^Danone/, 'evian, activia, alpro'],
 [/^Berkshire/, 'geico, bnsf, dairy queen, duracell'],
 [/^Exxon/, 'esso, mobil'],
 [/^Chevron$/, 'texaco, caltex'],
 [/^BP$/, 'castrol, british petroleum'],
 [/^Shell plc/, 'royal dutch shell, pennzoil'],
 [/^Alibaba/, 'taobao, tmall, aliexpress, alipay, ant group, lazada'],
 [/^Tencent/, 'wechat, weixin'],
 [/^Sony$/, 'playstation'],
 [/^Samsung Electronics/, 'galaxy'],
 [/^UnitedHealth/, 'optum, unitedhealthcare'],
 [/^CVS/, 'aetna, caremark'],
 [/^Walgreens/, 'boots'],
 [/^Johnson & Johnson/, 'janssen, band-aid, neutrogena'],
 [/^Yum! Brands/, 'kfc, pizza hut, taco bell'],
 [/^Hon Hai/, 'foxconn'],
 [/^SoftBank/, 'arm holdings, vision fund'],
 [/^Reckitt/, 'dettol, durex, lysol, enfamil'],
 [/^Seven & I/, '7-eleven, seven-eleven'],
 [/^Mitsubishi UFJ/, 'mufg'],
 [/^Reliance Industries/, 'jio'],
 [/^H&M/, 'hennes, cos, weekday']
];
const ALIAS = {}; ALIAS_SRC.forEach(([re, ks]) => { const e = D.find(x => x.t === 'company' && re.test(x.n)); if (e) ALIAS[e.s] = ks.split(',').map(t => t.trim().toLowerCase()).filter(Boolean); });
const skey = e => (e.n + ' ' + (e.on ? e.on + ' ' : '') + (e.cn || '')).toLowerCase();
const ALIAS_CASE = {'aws':'AWS','youtube':'YouTube','deepmind':'DeepMind','whatsapp':'WhatsApp','linkedin':'LinkedIn','github':'GitHub','iphone':'iPhone','ipad':'iPad','macbook':'MacBook','itunes':'iTunes','playstation':'PlayStation','jlr':'JLR','gmc':'GMC','ram':'Ram','kitkat':'KitKat','nescafe':'Nescafé','nescafé':'Nescafé','ben & jerry':'Ben & Jerry’s','hellmann':'Hellmann’s','oral-b':'Oral-B','p&g':'P&G','pull&bear':'Pull&Bear','sam\'s club':'Sam’s Club','abc':'ABC','nbc':'NBC','nbcuniversal':'NBCUniversal','espn':'ESPN','kfc':'KFC','mufg':'MUFG','cos':'COS','ab inbev':'AB InBev','wechat':'WeChat','aliexpress':'AliExpress','lays':'Lay’s','frito-lay':'Frito-Lay','geico':'GEICO','bnsf':'BNSF','unitedhealthcare':'UnitedHealthcare','mini':'MINI','moet':'Moët','moët':'Moët','citroen':'Citroën','citroën':'Citroën','7-eleven':'7-Eleven','seven-eleven':'Seven-Eleven','band-aid':'Band-Aid','xbox':'Xbox','head & shoulders':'Head & Shoulders','jio':'Jio'};
const aliasName = a => ALIAS_CASE[a] || a.replace(/(^|\s)([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase());
const aliasHit = (e, q) => e.n.toLowerCase().includes(q) ? '' : ((ALIAS[e.s] || []).find(a => a === q || (q.length >= 4 && (a.startsWith(q) || a.includes(' ' + q)))) || '');
const SEARCH = D.map(e => ({e, k: skey(e)}));
function searchBox(id, ph, onPick){
  return `<div class="search" id="${id}">${MAG}<input type="search" autocomplete="off" placeholder="${esc(ph)}" aria-label="${esc(ph)}"><div class="sugg" hidden></div></div>`;
}
function wireSearch(id, onPick, filter){
  const box = $('#' + id); if (!box) return;
  const inp = $('input', box), sg = $('.sugg', box); let act = -1, res = [];
  const pick = e => onPick ? onPick(e) : (location.hash = '#/e/' + e.s);
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase(); act = -1;
    if (q.length < 2) { sg.hidden = true; return; }
    res = SEARCH.filter(x => (x.k.includes(q) || aliasHit(x.e, q)) && (!filter || filter(x.e))).sort((a,b) => (b.e.n.toLowerCase().startsWith(q)) - (a.e.n.toLowerCase().startsWith(q)) || ['country','region','city','company'].indexOf(a.e.t) - ['country','region','city','company'].indexOf(b.e.t)).slice(0, 9).map(x => x.e);
    sg.innerHTML = res.length ? res.map((e,i) => `<a href="#/e/${e.s}" data-i="${i}">${typeBadge(e.t, e)}<span>${esc(e.n)}${aliasHit(e, q) ? ` <em style="font-weight:400;color:var(--muted)">(owns ${esc(aliasName(aliasHit(e, q)))})</em>` : ''}</span><small>${esc(targetPhrase(e))}</small></a>`).join('') : '<div class="empty" style="padding:14px">No match. Try a country, city, region or company name.</div>';
    sg.hidden = false;
  });
  sg.addEventListener('click', ev => { const a = ev.target.closest('a'); if (!a) return; ev.preventDefault(); sg.hidden = true; inp.value = ''; pick(res[+a.dataset.i]); });
  inp.addEventListener('keydown', ev => {
    const as = $$('a', sg); if (!as.length) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); act = (act + (ev.key === 'ArrowDown' ? 1 : -1) + as.length) % as.length; as.forEach((a,i) => a.classList.toggle('act', i === act)); }
    if (ev.key === 'Enter') { ev.preventDefault(); sg.hidden = true; inp.value=''; pick(res[Math.max(act,0)]); }
    if (ev.key === 'Escape') sg.hidden = true;
  });
  document.addEventListener('click', ev => { if (!box.contains(ev.target)) sg.hidden = true; });
}

/* ---------- aggregates ---------- */
const byType = t => D.filter(e => e.t === t);
const universe = t => byType(t).filter(e => t !== 'company' || e.priv !== 'Yes'); // headline counts follow the live site (public companies)
function gapStats(t){
  const xs = universe(t).filter(isNZ), n = xs.length;
  const f = fn => pct(xs.filter(fn).length, n);
  return { n,
    interim: f(e => e.it && e.it !== 'No target' && iyear(e) >= NOW && iyear(e) <= 2035),
    plan: f(e => e.plan === 'Yes' && e.po >= 4),
    rep: f(e => e.rep === 'Annual reporting'),
    gas: f(e => e.gas === 'Carbon dioxide and other GHGs'),
    nooff: f(e => e.off === 'No'),
    rem: f(e => e.rem === 'Yes'),
    law: t === 'company' ? null : f(e => level(e).k >= 4),
  };
}

/* ================= PAGES ================= */
const P = {};

/* ---------- HOME ---------- */
P.home = () => {
  const T = ['country','region','city','company'];
  const heads = T.map(t => { const u = universe(t), n = u.filter(isNZ).length; return {t, n, of:u.length}; });
  const G = Object.fromEntries(T.map(t => [t, gapStats(t)]));
  const cov = META.coverage || {emissions:74, gdp:77, population:79};
  const gapRows = [
    ['interim','Has a current milestone (2026–2035)','A near-term target, not just a distant date'],
    ['plan','Has a complete plan','All 4 elements: measures, expected cuts, scale, review'],
    ['rep','Reports progress every year','So the public can check the trend'],
    ['gas','Covers all greenhouse gases','Not just CO₂'],
    ['nooff','Rules out carbon offsets','Relies on its own cuts'],
  ];
  return `
  <section class="hero"><svg class="dots" viewBox="0 0 400 400" aria-hidden="true">${dotHalo()}</svg>
   <div class="wrap">
    <p class="eyebrow" style="color:#ffb3a8">The global record of net zero promises</p>
    <h1>Who has promised net zero, <span>and does the promise hold up?</span></h1>
    <p>We track ${fmt(D.length)} countries, regions, cities and companies. For each one we check whether its target is real, covers all its emissions, has a plan behind it and avoids leaning on offsets.</p>
    ${searchBox('s-home','Search a country, region, city or company, e.g. "Brazil", "Lagos", "Apple"')}
    <div class="search hint" style="margin-top:10px">Try: <a href="#/e/${slugOf('United Kingdom','country')}">United Kingdom</a> · <a href="#/e/${slugOf('India','country')}">India</a> · <a href="#/e/${slugOf('California','region')}">California</a> · <a href="#/e/${slugOf('Walmart','company')}">Walmart</a> · <a href="#/explore">browse everything</a></div>
   </div></section>

  <section class="band notch"><div class="wrap">
    <div class="center"><h2 class="h-brand">Net zero at a glance</h2>
    <p class="lede">How many have set a net zero target, out of everyone we track. Click a number to see the list.</p></div>
    <div class="stats">${heads.map(h => `<a class="stat" href="#/explore?type=${h.t}&nz=1"><div class="big">${fmt(h.n)}</div><div class="of">of ${fmt(h.of)} ${TYPE[h.t][1].toLowerCase()}</div><div class="what">${pct(h.n,h.of)}% have a net zero target</div><div class="meter"><i style="width:${pct(h.n,h.of)}%"></i></div></a>`).join('')}</div>
    <h3 class="mt3 center" style="font-size:20px">National net zero targets already cover…</h3>
    <div class="cover">
      <div class="c"><div class="pct">${cov.emissions}%</div><div class="meter"><i style="width:${cov.emissions}%;background:var(--brown)"></i></div><p>of the world's <b>greenhouse gas emissions</b></p></div>
      <div class="c"><div class="pct">${cov.gdp}%</div><div class="meter"><i style="width:${cov.gdp}%;background:var(--green)"></i></div><p>of the world's <b>economy</b> (GDP, PPP)</p></div>
      <div class="c"><div class="pct">${cov.population}%</div><div class="meter"><i style="width:${cov.population}%;background:var(--blue)"></i></div><p>of the world's <b>people</b></p></div>
    </div>
    <p class="foot-note center" style="margin-inline:auto">Counts only national targets. The United States rescinded its federal target in 2025. Counting US states with their own targets would raise economic coverage to at least 84%.</p>
  </div></section>

  <section><div class="wrap">
    <div class="grid2" style="align-items:end"><div><p class="eyebrow">The credibility gap</p><h2 class="h-brand">A target is not a plan</h2></div>
    <p class="lede mt0">Most net zero targets are missing the parts that make them believable. Of those <b>with</b> a net zero target, the share that also…</p></div>
    <div class="tablewrap mt2" style="border:0"><table class="gap-chart" style="min-width:720px">
      <thead><tr><th></th>${T.map(t => `<th>${TYPE[t][1]} <span style="font-weight:500">(${fmt(G[t].n)})</span></th>`).join('')}</tr></thead>
      <tbody>${gapRows.map(([k,q,s]) => `<tr><td class="q">${q}<small>${s}</small></td>${T.map(t => `<td><div class="hb" title="${G[t][k]}% of ${TYPE[t][1].toLowerCase()} with a net zero target"><div class="tr"><i style="width:${G[t][k]}%"></i></div><span>${G[t][k]}%</span></div></td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="foot-note">Share of entities with a net zero (or similar) target that meet each criterion. "Unknown" counts as not met. <a href="#/learn/method">How we assess targets</a>.</p>
  </div></section>

  <section class="band"><div class="wrap">
    <div class="center"><h2 class="h-brand">Where net zero targets stand</h2><p class="lede">Countries, regions and cities on one map. Pick how to colour it, and the key sits right under your choice. Hover for a summary and click for the full profile.</p></div>
    <div class="mt2">${mapBlock('m-home')}</div>
  </div></section>

  <section><div class="wrap">
    <div class="center"><h2 class="h-brand">The world's largest companies</h2><p class="lede">One box for each of the ${fmt(universe('company').length)} biggest public companies, grouped by sector. Bigger box, bigger revenue. Colour it the same ways as the map.</p></div>
    <div class="mt2">${vizShell('c-home')}</div>
  </div></section>

  <section><div class="wrap">
    <div class="center"><h2 class="h-brand">Start here</h2><p class="lede">Different jobs, different shortcuts.</p></div>
    <div class="grid3 mt2">
      <a class="card path" href="#/policymakers"><span class="who">Policymakers &amp; officials</span><h3>Benchmark your jurisdiction</h3><ul><li>See how you compare with peers</li><li>Find exactly what your target is missing</li><li>Copy a ready-to-use briefing paragraph</li></ul><span class="go">Policymaker guide →</span></a>
      <a class="card path" href="#/advocates"><span class="who">Advocates &amp; campaigners</span><h3>Hold a target to account</h3><ul><li>Spot the six warning signs of a weak pledge</li><li>Get questions to put to a company or council</li><li>Cite the data correctly</li></ul><span class="go">Advocate toolkit →</span></a>
      <a class="card path" href="#/compare"><span class="who">Journalists &amp; researchers</span><h3>Compare and download</h3><ul><li>Put up to 4 entries side by side</li><li>Filter and export any list as CSV</li><li>Link every claim to its source</li></ul><span class="go">Compare tool →</span></a>
    </div>
  </div></section>

  <section class="band"><div class="wrap">
    <div class="center"><h2 class="h-brand">What makes a good net zero target?</h2><p class="lede">We ask four questions of every target. Each profile answers them in plain language.</p></div>
    <div class="grid4 mt2">${pillarCards()}</div>
    <p class="center mt2"><a class="btn btn-purple" href="#/learn">Net zero explained in 2 minutes</a></p>
  </div></section>

  <section id="climate-now"><div class="wrap">
    <div class="center"><h2 class="h-brand">Climate change so far</h2><p class="lede">Why net zero matters: where the world stands today. Open any country, region or city profile to see its own effects.</p></div>
    <div class="fxglobal mt2" id="gfx"><p class="muted center">Loading…</p></div>
  </div></section>`;
};
P.home.after = () => { wireSearch('s-home'); drawMap('m-home'); drawCompanies('c-home'); globalFxShow(); };
function slugOf(name, t){ const e = D.find(x => x.n === name && x.t === t); return e ? e.s : ''; }
function pillarCards(){
  const txt = {
    target:['Is it legally binding or just announced? Is there a milestone in the next 5 to 10 years?', ICON.yes],
    cover:['Does it include methane and other gases, and for companies, their supply chain and products?', ICON.yes],
    gov:['Is there a published plan, yearly reporting and someone responsible for delivery?', ICON.yes],
    off:['Is it cutting its own emissions, or paying others to offset them?', ICON.yes],
  };
  return PILLARS.map(p => `<div class="card pillar" style="--p:${p.col}"><div class="ico" style="color:${p.col}">${pillarIcon(p.id)}</div><h3>${p.name}</h3><p>${txt[p.id][0]}</p></div>`).join('');
}
function pillarIcon(id){
  const s = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return {
    target:`<svg width="24" height="24" viewBox="0 0 24 24" ${s}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>`,
    cover:`<svg width="24" height="24" viewBox="0 0 24 24" ${s}><path d="M3 12a9 9 0 1 0 9-9"/><path d="M12 3v9h9"/></svg>`,
    gov:`<svg width="24" height="24" viewBox="0 0 24 24" ${s}><path d="M9 4h6v3H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="M8.5 13l2.2 2.2L15.5 10.5"/></svg>`,
    off:`<svg width="24" height="24" viewBox="0 0 24 24" ${s}><path d="M12 21V11"/><path d="M12 11C12 6 8 4 4 4c0 5 3 7 8 7z"/><path d="M12 14c0-4 3-6 8-6 0 4-3 6-8 6z"/></svg>`,
  }[id];
}
function dotHalo(){ let s=''; for (let r=40;r<200;r+=11){ const n=Math.floor(r*0.55); for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+r; const x=200+Math.cos(a)*r, y=200+Math.sin(a)*r; const hue=['#3B7CC3','#5EA845','#FAA542','#E13B26','#7D7089'][Math.floor((a%(Math.PI*2))/(Math.PI*2)*5+5)%5]; s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.6-r/260).toFixed(2)}" fill="${hue}" opacity="${(0.25+r/320).toFixed(2)}"/>`; } } return s; }

/* ---------- VISUAL MODES (shared by the map and the company chart) ---------- */
const checkMemo = new Map();
const nChecks = e => { let r = checkMemo.get(e.s); if (!r) { const cs = checks(e); r = {y: tally(cs).yes, n: cs.length}; checkMemo.set(e.s, r); } return r; };
const MODES = {
  status:{name:'How firm is the commitment?', help:'From a promise on paper to a law.',
    cats:[...LADDER.slice().reverse().map(l => ({label:l.label, hex:l.hex})), {label:'Status unclear', hex:'#e9e7ec'}, {label:OTHER.label, hex:OTHER.hex}, {label:NONE.label, hex:NONE.hex}],
    of:e => level(e).label},
  year:{name:'Net zero by when?', help:'The year the target is meant to be reached.',
    cats:[{label:'2040 or earlier', hex:'#24572a'},{label:'2041–2050', hex:'#4a8a3c'},{label:'2051–2060', hex:'#7db165'},{label:'After 2060', hex:'#b2d49b'},{label:'Net zero, year not given', hex:'#e6d6bd'},{label:'No net zero target', hex:'#c9c7cc'}],
    of:e => { if (!isNZ(e)) return 'No net zero target'; const y = year(e); if (!y) return 'Net zero, year not given'; return y <= 2040 ? '2040 or earlier' : y <= 2050 ? '2041–2050' : y <= 2060 ? '2051–2060' : 'After 2060'; }},
  interim:{name:'Milestone before 2035?', help:'Is there a near-term step, not just a far-off date?',
    cats:[{label:'Milestone between 2026 and 2035', hex:'#4a8a3c'},{label:'Net zero, but no milestone by 2035', hex:'#e6d6bd'},{label:'No net zero target', hex:'#c9c7cc'}],
    of:e => { if (!isNZ(e)) return 'No net zero target'; return e.it && e.it !== 'No target' && iyear(e) >= NOW && iyear(e) <= 2035 ? 'Milestone between 2026 and 2035' : 'Net zero, but no milestone by 2035'; }},
  checks:{name:'How many credibility checks?', help:'How many of our yes/no checks the target meets.',
    cats:[{label:'7 or more checks met', hex:'#4b2a73'},{label:'5–6 checks met', hex:'#8d68b3'},{label:'3–4 checks met', hex:'#bfa9d6'},{label:'0–2 checks met', hex:'#e4dcee'},{label:'No net zero target', hex:'#c9c7cc'}],
    of:e => { if (!isNZ(e)) return 'No net zero target'; const n = nChecks(e).y; return n >= 7 ? '7 or more checks met' : n >= 5 ? '5–6 checks met' : n >= 3 ? '3–4 checks met' : '0–2 checks met'; }},
};
function catOf(mode, e){ const M = MODES[mode], lab = M.of(e); return M.cats.find(c => c.label === lab) || M.cats[M.cats.length - 1]; }
const textOn = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299*r + 0.587*g + 0.114*b) < 140 ? '#fff' : '#1c1622'; };
function tipHtml(e){
  const cs = checks(e), t = tally(cs), loc = e.t === 'country' ? '' : (e.cn ? ' · ' + esc(e.cn) : '');
  return `<b>${e.t === 'country' ? flag(e.a2) + ' ' : ''}${esc(e.n)}</b> <span class="k">${typeWord(e)}${loc}</span><br>${esc(targetPhrase(e))}<br><span class="k">Commitment:</span> ${esc(level(e).label)}${isNZ(e) ? `<br><span class="k">Credibility checks met:</span> ${t.yes} of ${cs.length}` : ''}<br><span class="k" style="font-size:12.5px">Click for the full profile</span>`;
}

/* The side panel: layer switches, then the colour menu with the legend nested under the active option */
const VZ = {};
const LAYER_ICON = {
  country:'<svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><path d="M2 4l7-2 5 2 6-1v9l-6 2-5-2-7 2z" fill="#4a8a3c"/></svg>',
  region:'<svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><path d="M3 5l6-3 6 2 4 4-3 5-7 1-6-4z" fill="#b2d49b" stroke="#271039" stroke-width="1.4"/></svg>',
  city:'<svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><circle cx="11" cy="8" r="5" fill="#4a8a3c" stroke="#fff" stroke-width="2"/><circle cx="11" cy="8" r="6.3" fill="none" stroke="#271039" stroke-width="1"/></svg>',
};
function panelHTML(st){
  const top = st.kind === 'map'
    ? `<div class="vh">Show on the map</div><div class="layers">${['country','region','city'].map(k => `<label><input type="checkbox" data-layer="${k}" ${st.layers[k] ? 'checked' : ''}>${LAYER_ICON[k]}<span>${TYPE[k][1]}</span><b>${fmt(st.n[k])}</b></label>`).join('')}</div>`
    : `<div class="vh">Size boxes by</div><div class="seg" role="group" aria-label="Box size"><button data-size="rev" class="${st.size === 'rev' ? 'on' : ''}">Annual revenue</button><button data-size="eq" class="${st.size === 'eq' ? 'on' : ''}">Equal size</button></div>`;
  const modes = Object.entries(MODES).map(([k, M]) => {
    const on = st.mode === k;
    return `<div class="mode ${on ? 'on' : ''}"><button class="mbtn" data-mode="${k}" aria-pressed="${on}"><span class="rad"></span><span><b>${M.name}</b><small>${M.help}</small></span></button>${on ? `<div class="mlegend" role="group" aria-label="Legend for: ${esc(M.name)}">${M.cats.filter(c => st.counts[c.label]).map(c => `<button class="li ${st.hl === c.label ? 'on' : ''}" data-cat="${esc(c.label)}" aria-pressed="${st.hl === c.label}"><i style="background:${c.hex}"></i><span>${esc(c.label)}</span><b>${fmt(st.counts[c.label])}</b></button>`).join('')}<p class="lhint">Click a row to highlight just those on the ${st.kind === 'map' ? 'map' : 'chart'}.</p></div>` : ''}</div>`;
  }).join('');
  return `${top}<div class="vh" style="margin-top:16px">Colour by</div><div class="modes">${modes}</div>`;
}
function vizShell(id){ return `<div class="viz" id="${id}"><aside class="vpanel"><div class="empty" style="padding:20px">Loading…</div></aside><div class="vmain"><div class="mapbox"><div class="empty">Loading…</div></div></div></div>`; }
function recount(st){
  st.counts = {};
  const add = e => { const l = catOf(st.mode, e).label; st.counts[l] = (st.counts[l] || 0) + 1; };
  if (st.kind === 'map') ['country','region','city'].forEach(k => st.layers[k] && st.ents[k].forEach(add)); else st.ents.forEach(add);
}
function paint(st){
  const root = $('#' + st.id + ' .mapbox'); if (!root) return;
  recount(st);
  $$('[data-s]', root).forEach(el => { const c = catOf(st.mode, BY[el.dataset.s]); el.setAttribute('fill', c.hex); el.dataset.cat = c.label; });
  $$('text.tl', root).forEach(t => t.setAttribute('fill', textOn(catOf(st.mode, BY[t.dataset.for]).hex)));
  applyHl(st);
  $('#' + st.id + ' .vpanel').innerHTML = panelHTML(st);
  wirePanel(st);
}
function applyHl(st){
  const root = $('#' + st.id + ' .mapbox'); if (!root) return;
  if (st.kind === 'co' && st.narrow && !st.sec) renderSecGrid(st);
  root.classList.toggle('dim', !!st.hl);
  $$('[data-s]', root).forEach(el => el.classList.toggle('hl', !!st.hl && el.dataset.cat === st.hl));
}
function wirePanel(st){
  const panel = $('#' + st.id + ' .vpanel');
  $$('[data-layer]', panel).forEach(cb => cb.onchange = () => { st.layers[cb.dataset.layer] = cb.checked; $(`#${st.id} g.L-${cb.dataset.layer}`).style.display = cb.checked ? '' : 'none'; st.hl = null; paint(st); });
  $$('[data-mode]', panel).forEach(b => b.onclick = () => { if (st.mode === b.dataset.mode) return; st.mode = b.dataset.mode; st.hl = null; paint(st); });
  $$('[data-cat]', panel).forEach(b => b.onclick = () => { st.hl = st.hl === b.dataset.cat ? null : b.dataset.cat; applyHl(st); $$('[data-cat]', panel).forEach(x => { const on = x.dataset.cat === st.hl; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); });
  $$('[data-size]', panel).forEach(b => b.onclick = () => { st.size = b.dataset.size; st.hl = null; drawTreemap(st); });
}
function fixWinding(f){
  // some island parts in the boundary file wind the wrong way, which d3 reads as "everything except this island"
  const fix = poly => d3.geoArea({type:'Polygon', coordinates:poly}) > 2 * Math.PI ? poly.map(r => r.slice().reverse()) : poly;
  f.geometry.coordinates = f.geometry.type === 'Polygon' ? fix(f.geometry.coordinates) : f.geometry.coordinates.map(fix);
  return f;
}

/* ---------- INTEGRATED MAP: countries, regions and cities ---------- */
let WORLD = null, REG = null;
const mapBlock = id => vizShell(id);
async function drawMap(id){
  const box = $('#' + id); if (!box) return;
  if (!window.d3 || !window.topojson) { box.innerHTML = '<div class="empty">The map library did not load. The tables below hold the same data.</div>'; return; }
  const st = VZ[id] = {id, kind:'map', mode:'status', hl:null, layers:{country:true, region:true, city:true}, counts:{}};
  try { [WORLD, REG] = await Promise.all([WORLD || fetch('world.json').then(r => r.json()), REG || fetch('regions.json').then(r => r.json())]); }
  catch (e) { box.innerHTML = '<div class="empty">The map data could not load.</div>'; return; }
  if (!document.body.contains(box)) return;
  const W = 960, H = 500, narrow = innerWidth < 700, touch = matchMedia('(hover: none)').matches;
  const cf = topojson.feature(WORLD, WORLD.objects.countries).features.filter(f => f.id !== '010');
  const rf = topojson.feature(REG, REG.objects.regions).features.filter(f => BY[f.properties.s] && f.geometry).map(fixWinding);
  const proj = d3.geoNaturalEarth1().fitExtent([[4,4],[W-4,H-4]], {type:'FeatureCollection', features:cf}), path = d3.geoPath(proj);
  const byIso = {}; D.forEach(e => { if (e.t === 'country' && e.iso) byIso[e.iso] = e; });
  const cp = cf.map(f => path(f));
  const pins = D.filter(e => e.t === 'city' && e.ll).map(e => { const p = proj([e.ll[1], e.ll[0]]); return p ? {e, x:p[0], y:p[1]} : null; }).filter(Boolean);
  st.ents = {country:Object.values(byIso), region:rf.map(f => BY[f.properties.s]), city:pins.map(p => p.e)};
  st.n = {country:st.ents.country.length, region:st.ents.region.length, city:st.ents.city.length};
  box.innerHTML = `<aside class="vpanel"></aside><div class="vmain">
    <div class="mapbox"><div class="zoomctl"><button data-z="in" aria-label="Zoom in">+</button><button data-z="out" aria-label="Zoom out">−</button><button data-z="reset" aria-label="Reset zoom" style="font-size:13px">⟲</button></div>
    <svg viewBox="0 0 ${W} ${H}"${narrow ? ' class="tall" preserveAspectRatio="xMidYMid slice"' : ''} role="img" aria-label="World map of net zero targets for countries, regions and cities. The same information is in the tables below.">
      <g class="zoomer"><g class="L-base">${cp.map(d => `<path class="base" d="${d}"></path>`).join('')}</g><g class="L-country">${cf.map((f, i) => { const e = byIso[f.id]; return `<path class="land c" d="${cp[i]}"${e ? ` data-s="${e.s}"` : ' fill="#ececec"'}></path>`; }).join('')}</g>
      <g class="L-region">${rf.map(f => `<path class="land r" d="${path(f)}" data-s="${f.properties.s}"></path>`).join('')}</g>
      <g class="L-city">${pins.map(p => `<circle class="pin" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${narrow ? 3.2 : 3.4}" data-s="${p.e.s}"></circle>`).join('')}</g></g>
    </svg></div>
    <p class="foot-note">${touch || narrow ? 'Drag to move the map, pinch or use + and − to zoom, and tap a place for its details.' : 'Drag to move the map. Zoom with the + and − buttons, or hold Ctrl or ⌘ and scroll.'} Cities show as dots, regions as outlined areas. ${fmt(722 - st.n.region)} regions and ${fmt(1185 - st.n.city)} city cannot be placed on the map yet, but they are in the tables.</p></div>`;
  const svgEl = $('svg', box), svg = d3.select(svgEl), gz = svg.select('g.zoomer'); let k = 1;
  // on a phone the map fills a tall box cropped at the sides, so zoom works on the visible part and one finger can pan sideways
  const vis = (() => { if (!narrow) return [[0,0],[W,H]]; const cw = svgEl.clientWidth || 360, ch = svgEl.clientHeight || 480, sc = Math.max(cw / W, ch / H), vw = cw / sc, vh = ch / sc; return [[(W - vw) / 2, (H - vh) / 2], [(W + vw) / 2, (H + vh) / 2]]; })();
  const zoom = d3.zoom().scaleExtent([1, 16]).translateExtent([[0,0],[W,H]]).extent(vis)
    .filter(ev => ev.type === 'wheel' ? (ev.ctrlKey || ev.metaKey) : ev.type.startsWith('touch') ? (narrow || k > 1 || (ev.touches && ev.touches.length > 1)) : !ev.button)
    .on('zoom', ev => { k = ev.transform.k; gz.attr('transform', ev.transform); gz.selectAll('circle.pin').attr('r', Math.max(1.5, (narrow ? 3.4 : 3.6) / Math.pow(k, 0.62))); });
  svg.call(zoom); svgEl.style.touchAction = narrow ? 'pan-y' : 'pan-y pinch-zoom';
  if (narrow) { const c0 = proj([12, 18]); zoom.translateTo(svg, c0[0], c0[1]); }
  $$('[data-z]', box).forEach(b => b.onclick = () => { const a = b.dataset.z; svg.transition().duration(220).call(a === 'reset' ? zoom.transform : zoom.scaleBy, a === 'reset' ? d3.zoomIdentity : (a === 'in' ? 1.7 : 1 / 1.7)); });
  svgEl.addEventListener('mousemove', ev => { const el = ev.target.closest('[data-s]'); if (!el) return hideTip(); showTip(tipHtml(BY[el.dataset.s]), ev); });
  svgEl.addEventListener('mouseleave', hideTip);
  svgEl.addEventListener('click', ev => { const el = ev.target.closest('[data-s]'); if (!el) return; hideTip(); if (matchMedia('(hover: none)').matches) placeCard(el.closest('.mapbox'), BY[el.dataset.s]); else location.hash = '#/e/' + el.dataset.s; });
  paint(st);
}

/* ---------- COMPANY TREEMAP ---------- */
async function drawCompanies(id){
  const box = $('#' + id); if (!box) return;
  if (!window.d3) { box.innerHTML = '<div class="empty">The chart library did not load. The table has the same data.</div>'; return; }
  const ents = universe('company');
  const st = VZ[id] = {id, kind:'co', mode:'status', size:'rev', hl:null, counts:{}, ents, narrow: innerWidth < 700, sec: null};
  box.innerHTML = `<aside class="vpanel"></aside><div class="vmain"><div class="mapbox"><svg viewBox="0 0 960 560" role="img" aria-label="Treemap of the world's largest public companies, grouped by sector. Each box is a company. The table below has the same data."></svg></div><p class="foot-note" id="${id}-cap"></p></div>`;
  const svgEl = $('.mapbox', box);  // listeners on the box, because a phone swaps the chart inside it
  svgEl.addEventListener('mousemove', ev => { const el = ev.target.closest('[data-s]'); if (!el) return hideTip(); showTip(tipHtml(BY[el.dataset.s]) , ev); });
  svgEl.addEventListener('mouseleave', hideTip);
  svgEl.addEventListener('click', ev => { const el = ev.target.closest('[data-s]'); if (!el) return; hideTip(); if (matchMedia('(hover: none)').matches) placeCard(el.closest('.mapbox'), BY[el.dataset.s]); else location.hash = '#/e/' + el.dataset.s; });
  const revAll = ents.reduce((s, e) => s + (e.rev || 0), 0), revNZ = ents.filter(isNZ).reduce((s, e) => s + (e.rev || 0), 0);
  $('#' + id + '-cap').innerHTML = `Each box is one company, grouped by sector. <b>${pct(ents.filter(isNZ).length, ents.length)}%</b> of these ${fmt(ents.length)} public companies have a net zero target, and together they earn <b>${pct(revNZ, revAll)}%</b> of the group's combined revenue. Companies with no revenue figure are drawn small.`;
  drawTreemap(st);
}
function drawTreemap(st){
  const mb = $('#' + st.id + ' .mapbox'); if (!mb) return;
  const bySec = new Map();
  st.ents.forEach(e => { const s = e.sec && e.sec !== 'NA' ? e.sec : 'Other / unclassified'; if (!bySec.has(s)) bySec.set(s, []); bySec.get(s).push(e); });
  st.secs = bySec;
  if (st.narrow && !st.sec) { mb.innerHTML = '<div class="secgrid"></div>'; paint(st); return; }
  const groups = st.narrow ? [[st.sec, bySec.get(st.sec) || []]] : [...bySec];
  const W = st.narrow ? 400 : 960, H = st.narrow ? Math.min(1500, Math.max(440, groups[0][1].length * 7)) : 560;
  if (st.narrow) mb.innerHTML = `<div class="secbar"><button class="btn btn-ghost btn-sm" data-back>← All sectors</button><span><b>${esc(st.sec)}</b> <span class="muted">· ${fmt(groups[0][1].length)} companies</span></span></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Companies in ${esc(st.sec)}, one box each. The table below has the same data."></svg>`;
  else if (!$('svg', mb) || $('.secbar', mb)) mb.innerHTML = `<svg viewBox="0 0 960 560" role="img" aria-label="Treemap of the world's largest public companies, grouped by sector. Each box is a company. The table below has the same data."></svg>`;
  const svgEl = $('svg', mb);
  const root = d3.hierarchy({children: groups.map(([name, c]) => ({name, children:c}))}).sum(d => d.s ? (st.size === 'rev' ? Math.max(d.rev || 0, 2e8) : 1) : 0).sort((a, b) => b.value - a.value);
  d3.treemap().size([W, H]).paddingOuter(st.narrow ? 0 : 3).paddingTop(d => d.depth === 1 && !st.narrow ? 19 : 0).paddingInner(1).round(true)(root);
  const short = (t, w, px) => { const n = Math.floor(w / px); return t.length > n ? t.slice(0, Math.max(n - 1, 0)).trim() + '…' : t; };
  svgEl.innerHTML = root.children.map(g => `<g>${st.narrow ? '' : `<text x="${g.x0 + 3}" y="${g.y0 + 14}" class="tg">${esc(short(g.data.name.toUpperCase(), g.x1 - g.x0 - 6, 7.6))}</text>`}${g.children.map(c => {
    const w = c.x1 - c.x0, h = c.y1 - c.y0, e = c.data;
    return `<rect x="${c.x0}" y="${c.y0}" width="${w}" height="${h}" data-s="${e.s}"></rect>`; }).join('')}</g>`).join('') +
    root.leaves().map(c => { const w = c.x1 - c.x0, h = c.y1 - c.y0; return w > 62 && h > 20 ? `<text class="tl" data-for="${c.data.s}" x="${c.x0 + 4}" y="${c.y0 + 14}">${esc(short(c.data.n, w - 8, 6.6))}</text>` : ''; }).join('');
  const bk = $('[data-back]', mb); if (bk) bk.onclick = () => { st.sec = null; drawTreemap(st); mb.scrollIntoView({block: 'nearest'}); };
  paint(st);
}
function renderSecGrid(st){
  const g = $('#' + st.id + ' .secgrid'); if (!g || !st.secs) return;
  const M = MODES[st.mode];
  g.innerHTML = [...st.secs].sort((a, b) => b[1].length - a[1].length).map(([name, es]) => {
    const cnt = {}; es.forEach(e => { const l = catOf(st.mode, e).label; cnt[l] = (cnt[l] || 0) + 1; });
    const bar = M.cats.filter(c => cnt[c.label]).map(c => `<i style="width:${(cnt[c.label] / es.length * 100).toFixed(2)}%;background:${c.hex}${st.hl && st.hl !== c.label ? ';opacity:.2' : ''}" title="${esc(c.label)}: ${cnt[c.label]}"></i>`).join('');
    return `<button class="seccard" data-sec="${esc(name)}"><b>${esc(name)}</b><span>${fmt(es.length)} companies · ${pct(es.filter(isNZ).length, es.length)}% net zero</span><span class="sbar">${bar}</span></button>`; }).join('');
  $$('[data-sec]', g).forEach(b => b.onclick = () => { st.sec = b.dataset.sec; drawTreemap(st); });
}

/* ---------- EXPLORE ---------- */
const EX = {type:'country', q:'', g:'', st:'', nz:false, sec:'', sort:'size', dir:1, page:0};
P.explore = (params) => {
  if (params.type && TYPE[params.type]) EX.type = params.type;
  if (params.nz) EX.nz = params.nz === '1';
  if (params.st) EX.st = params.st;
  EX.page = 0;
  const regions = [...new Set(D.map(e => e.g).filter(Boolean))].sort();
  return `<section class="tight band"><div class="wrap">
    <h1 class="h-brand" style="font-size:clamp(28px,4vw,40px)">Explore the data</h1>
    <p class="lede mt0">Every target we track, in plain language. Switch between governments and companies, explore the picture, then filter the list below, click any name for the full profile, or export what you see.</p>
    <div class="seg mt2" id="ex-view" role="group" aria-label="What to show"><button data-v="gov" class="${EX.type==='company' ? '' : 'on'}"><b>Governments</b><span>Countries, regions and cities</span></button><button data-v="co" class="${EX.type==='company' ? 'on' : ''}"><b>Companies</b><span>The largest companies</span></button></div>
    <div class="mt2"><div id="ex-gviz" ${EX.type==='company' ? 'hidden' : ''}>${mapBlock('m-ex')}</div><div id="ex-cviz" ${EX.type==='company' ? '' : 'hidden'}>${vizShell('c-ex')}</div></div>
  </div></section>
  <section class="tight"><div class="wrap">
    <div class="tabs" id="ex-tabs">${Object.keys(TYPE).map(t => `<button data-t="${t}" class="${t===EX.type?'on':''}">${TYPE[t][1]} <span class="muted">(${fmt(byType(t).length)})</span></button>`).join('')}</div>
    <div class="filters">
      <label>Search<input type="search" id="ex-q" placeholder="Name or country" value="${esc(EX.q)}"></label>
      <label>Geographic region<select id="ex-g"><option value="">All regions</option>${regions.map(r => `<option ${r===EX.g?'selected':''}>${esc(r)}</option>`).join('')}</select></label>
      <label>Commitment<select id="ex-st"><option value="">Any</option>${[...LADDER.slice().reverse(), OTHER, NONE].map(l => `<option value="${l.k}" ${String(l.k)===EX.st?'selected':''}>${esc(l.label)}</option>`).join('')}</select></label>
      <label id="ex-sec-l" ${EX.type==='company'?'':'hidden'}>Sector<select id="ex-sec"><option value="">All sectors</option>${[...new Set(byType('company').map(e => e.sec).filter(s => s && s !== 'NA'))].sort().map(s => `<option ${s===EX.sec?'selected':''}>${esc(s)}</option>`).join('')}</select></label>
      <label style="flex-direction:row;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:15px;color:var(--ink);font-weight:500;padding-bottom:9px"><input type="checkbox" id="ex-nz" ${EX.nz?'checked':''}> Only net zero targets</label>
      <span style="margin-left:auto;display:flex;gap:8px"><button class="btn btn-ghost btn-sm" id="ex-csv">Export CSV</button></span>
    </div>
    <div id="ex-out"></div>
  </div></section>
  <section class="tight band" id="ex-global" hidden><div class="wrap"><h2 class="h-brand" style="font-size:24px">How countries add up to global emissions</h2><p class="muted mt0">The countries' greenhouse gas emissions since 1990 add up to the global total. The lines show the Paris-aligned pathway, and where current policies, national targets (NDCs) and pledges would take emissions.</p><div id="ex-global-body"></div></div></section>`;
};
P.explore.after = () => {
  drawMap('m-ex'); drawCompanies('c-ex');
  const showView = v => { $('#ex-gviz').hidden = v !== 'gov'; $('#ex-cviz').hidden = v !== 'co'; $$('#ex-view button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); };
  $$('#ex-view button').forEach(b => b.onclick = () => { const v = b.dataset.v; showView(v);
    EX.type = v === 'co' ? 'company' : (EX.type === 'company' ? 'country' : EX.type); EX.sec = ''; const sel = $('#ex-sec'); if (sel) sel.value = '';
    $$('#ex-tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === EX.type)); $('#ex-sec-l').hidden = EX.type !== 'company'; EX.page = 0; renderList(); });
  const rer = () => { EX.page = 0; renderList(); };
  $$('#ex-tabs button').forEach(b => b.onclick = () => { EX.type = b.dataset.t; EX.sec=''; $$('#ex-tabs button').forEach(x => x.classList.toggle('on', x === b)); $('#ex-sec-l').hidden = EX.type !== 'company'; showView(EX.type === 'company' ? 'co' : 'gov'); rer(); });
  $('#ex-q').oninput = e => { EX.q = e.target.value; rer(); };
  $('#ex-g').onchange = e => { EX.g = e.target.value; rer(); };
  $('#ex-st').onchange = e => { EX.st = e.target.value; rer(); };
  $('#ex-sec').onchange = e => { EX.sec = e.target.value; rer(); };
  $('#ex-nz').onchange = e => { EX.nz = e.target.checked; rer(); };
  $('#ex-csv').onclick = exportCSV;
  renderList();
};
function filtered(){
  const q = EX.q.trim().toLowerCase();
  let xs = byType(EX.type).filter(e => (!q || skey(e).includes(q) || aliasHit(e, q)) && (!EX.g || e.g === EX.g) && (!EX.nz || isNZ(e)) && (!EX.st || String(level(e).k) === EX.st) && (!EX.sec || e.sec === EX.sec));
  const key = {name:e => e.n.toLowerCase(), where:e => (where(e)||'').toLowerCase(), target:e => isNZ(e) ? (year(e) || 9999) : 99999, level:e => -level(e).k, interim:e => iyear(e) || 9999, score:e => -(isNZ(e) ? tally(checks(e)).yes : -1), size:e => -(e.rev || e.pop || 0)}[EX.sort];
  return xs.sort((a,b) => { const A = key(a), B = key(b); return (A < B ? -1 : A > B ? 1 : 0) * EX.dir; });
}

/* ---------- EXPLORE: how countries add up to global emissions, and the pathways ahead ---------- */
function loadGlobal(){ return window.NZG ? Promise.resolve(window.NZG) : new Promise(res => { const t = document.createElement('script'); t.src = 'global.js?v=20261120bz'; t.onload = () => res(window.NZG); t.onerror = () => res(null); document.head.appendChild(t); }); }
const GL_STACK = ['#cdb998', '#a9c4e4', '#c5bdd0', '#dcbcd6', '#e8c3a0', '#b9d8a8', '#f0d98f', '#e4b4b4', '#e8e4ec'];
const GL_SCN = {paris:['#2f8a4c', 'Paris-aligned pathway', 'Paris-aligned'], ndc:['#1f4e8c', 'All 2030 and 2035 NDCs met', 'NDCs met'], pledges:['#6b3fa0', 'All pledges and net zero targets met', 'All pledges met'], pol:['#c27a00', 'Current policies', 'Current policies'], none:['#E13B26', 'No further action (past trend continues)', 'No further action']};
function glScenarios(G){
  const C = G.cat, at = (a, i) => a[i], mid = (h, l) => h.map((v, i) => v == null || l[i] == null ? null : (v + l[i]) / 2);
  const hy = Object.keys(C.hist).map(Number).filter(y => y >= 2014 && y <= 2024), n = hy.length, mx = hy.reduce((a, b) => a + b, 0) / n, my = hy.reduce((a, y) => a + C.hist[y], 0) / n;
  const slope = hy.reduce((a, y) => a + (y - mx) * (C.hist[y] - my), 0) / hy.reduce((a, y) => a + (y - mx) ** 2, 0);
  const none = Array.from({length: 2100 - 2024 + 1}, (_, i) => C.hist[2024] + slope * i);
  const h24 = C.hist[2024], from24 = arr => arr.map((v, i) => i === 0 ? h24 : i === 1 && v != null ? Math.min(v, h24) : v);  // every pathway starts from the last past value
  return {paris:{hi:from24(C.paris.hi), lo:from24(C.paris.lo), mid:from24(C.paris.mid)}, ndc:{mid:from24(C.ndc)}, pledges:{hi:from24(C.pledges.hi), lo:from24(C.pledges.lo), mid:from24(mid(C.pledges.hi, C.pledges.lo))}, pol:{hi:from24(C.policies.hi), lo:from24(C.policies.lo), mid:from24(mid(C.policies.hi, C.policies.lo))}, none:{mid:none}, slope};
}
function globalChartHtml(G, st){
  const SC = glScenarios(G), x1 = st.to, x0 = st.from === '1850' ? G.y0 : 1990, off = x0 - G.y0, Gw = G.world.slice(off), Gs = G.s.map(l => l.slice(off)), W = 960, H = 400, Lm = 56, Rm = 190, T = 46, B = 36;
  const x = yr => Lm + (yr - x0) / (x1 - x0) * (W - Lm - Rm);
  const all = [...Gw, ...Object.values(SC).flatMap(o => o.mid ? o.mid.slice(0, x1 - 2024 + 1) : []).filter(v => v != null), ...SC.pol.hi.slice(0, x1 - 2024 + 1).filter(v => v != null)];
  const ymax = Math.max(...all) * 1.06, y = v => T + (1 - v / ymax) * (H - T - B);
  const nice = ymax / 5, mag = 10 ** Math.floor(Math.log10(nice)), ny = [1, 2, 5, 10].map(k => k * mag).find(k => k >= nice), yt = []; for (let t = 0; t <= ymax; t += ny) yt.push(t);
  const step = (x1 - x0) > 150 ? 50 : (x1 - x0) > 80 ? 20 : 10, ticks = []; for (let t = Math.ceil(x0 / step) * step; t <= x1; t += step) ticks.push(t);
  // stacked history
  const cum = Gs.map(() => []); Gw.forEach((_, i) => { let c = 0; Gs.forEach((layer, k) => { c += layer[i]; cum[k].push(c); }); });
  const area = k => { const top = cum[k], bot = k ? cum[k - 1] : Gw.map(() => 0); return `M${top.map((v, i) => `${x(x0 + i).toFixed(1)} ${y(v).toFixed(1)}`).join('L')}L${bot.map((v, i) => `${x(x0 + bot.length - 1 - i).toFixed(1)} ${y(bot[bot.length - 1 - i]).toFixed(1)}`).join('L')}Z`; };
  const lineOf = (arr, from = 2024) => arr.slice(0, x1 - from + 1).map((v, i) => v == null ? null : [from + i, v]).filter(Boolean);
  const path = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join('');
  const band = (hi, lo) => { const a = lineOf(hi), b = lineOf(lo); return `M${a.map(p => `${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join('L')}L${b.slice().reverse().map(p => `${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join('L')}Z`; };
  let out = `<svg viewBox="0 0 ${W} ${H}" id="gl-svg" data-x0="${x0}" data-x1="${x1}" data-lm="${Lm}" data-rm="${Rm}" data-w="${W}" role="img" aria-label="Global greenhouse gas emissions by country since 1990 and scenarios to ${x1}" style="width:100%;height:auto;display:block">
    ${yt.map(t => `<line x1="${Lm}" x2="${W - Rm}" y1="${y(t)}" y2="${y(t)}" stroke="#ece8ef"/><text x="${Lm - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="#7a7385">${t}</text>`).join('')}
    ${ticks.map(t => `<text x="${x(t)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="#7a7385">${t}</text>`).join('')}
    <text x="10" y="13" font-size="12" fill="#7a7385">Gt CO₂e per year</text>
    ${Gs.map((_, k) => `<path d="${area(k)}" fill="${GL_STACK[k]}" stroke="#fff" stroke-width=".6"><title>${esc(G.names[k])}</title></path>`).join('')}
    <path d="${path(Gw.map((v, i) => [x0 + i, v]))}" fill="none" stroke="#271039" stroke-width="2.4"/>
    <line x1="${x(2024)}" x2="${x(2024)}" y1="${T}" y2="${H - B}" stroke="#bdb6c6" stroke-dasharray="3 4"/>
    ${pmarks(x, x0, x1, T, H - B, 'lines')}
    ${['paris', 'pledges', 'pol'].map(k => `<path d="${band(SC[k].hi, SC[k].lo)}" fill="${GL_SCN[k][0]}" opacity=".13"/>`).join('')}
    ${[2030, 2035, 2050].filter(v => v <= x1).map(v => '').join('')}
    ${['pol', 'pledges', 'ndc', 'paris', 'none'].map(k => `<path d="${path(lineOf(SC[k].mid))}" fill="none" stroke="${GL_SCN[k][0]}" stroke-width="2.8" ${k === 'none' ? 'stroke-dasharray="7 5"' : ''} stroke-linejoin="round"/>`).join('')}
    <line id="gl-x" y1="${T}" y2="${H - B}" stroke="#271039" opacity="0"/>`;
  // end labels, spread apart
  const ends = ['pol', 'pledges', 'ndc', 'paris', 'none'].map(k => { const a = lineOf(SC[k].mid), p = a[a.length - 1]; return {k, yy: y(p[1]), v: p[1]}; }).sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 44) ends[i].yy = ends[i - 1].yy + 44;
  out += ends.map(e => `<text x="${x(x1) + 8}" y="${e.yy - 2}" font-size="12" font-weight="700" fill="${GL_SCN[e.k][0]}">${esc(GL_SCN[e.k][2])}</text><text x="${x(x1) + 8}" y="${e.yy + 12}" font-size="11.5" fill="#5f5869">${e.v.toFixed(0)} Gt in ${x1}</text>${(G.cat.temp || {})[e.k] ? `<text x="${x(x1) + 8}" y="${e.yy + 26}" font-size="11.5" font-weight="700" fill="${GL_SCN[e.k][0]}">+${G.cat.temp[e.k].y2100.toFixed(1)}°C by 2100</text>` : ''}`).join('');
  out += `<rect id="gl-hit" x="${Lm}" y="${T}" width="${W - Lm - Rm}" height="${H - T - B}" fill="transparent"/>${pmarks(x, x0, x1, T, H - B, 'labels')}</svg>`;
  window.__gl = {G, SC, x0, x1, from: x0};
  const g30 = (SC.pol.mid[6] - SC.paris.mid[6]);
  const stat = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  const stats = [stat('2024 (past)', `${G.cat.hist[2024].toFixed(0)} Gt`), stat('Paris-aligned pathway, 2030', `${SC.paris.mid[6].toFixed(0)} Gt`), stat('Current policies, 2030', `${SC.pol.lo[6].toFixed(0)}–${SC.pol.hi[6].toFixed(0)} Gt`), stat('Gap in 2030', `about ${g30.toFixed(0)} Gt`)].join('');
  return `<div class="emis-ctl"><div class="seg segs" id="gl-to" role="group" aria-label="How far ahead"><button data-t="2050" class="${x1 === 2050 ? 'on' : ''}"><b>To 2050</b></button><button data-t="2100" class="${x1 === 2100 ? 'on' : ''}"><b>To 2100</b></button></div><div class="seg segs" id="gl-from" role="group" aria-label="Start of the history"><button data-f="1850" class="${x0 === 1850 ? 'on' : ''}"><b>Since 1850</b></button><button data-f="1990" class="${x0 === 1990 ? 'on' : ''}"><b>Since 1990</b></button></div></div>
    <div class="card emis"><div class="emis-facts">${stats}</div>${out}
    <div class="emis-key" id="gl-leg">${G.names.map((n, k) => `<span class="glr" data-g="${k}" tabindex="0"><i style="background:${GL_STACK[k]}"></i>${esc(n)}</span>`).join('')}<span><i style="background:#271039;height:3px"></i>Global total</span></div>
    <div class="emis-key" style="margin-top:6px">${['paris', 'ndc', 'pledges', 'pol', 'none'].map(k => `<span><i style="background:${GL_SCN[k][0]};height:4px"></i>${esc(GL_SCN[k][1])}</span>`).join('')}</div>
    <p class="muted emis-src"><b>Past:</b> total greenhouse gas emissions by country, from <a href="https://ourworldindata.org/co2-and-greenhouse-gas-emissions" target="_blank" rel="noopener">Our World in Data</a> (including land use and forestry; Jones et al., 2024). Countries are grouped into regions, with China and the United States and Canada shown on their own; “Other” is international shipping and aviation and anything not matched to a country. <b>Ahead:</b> scenarios from the <a href="https://climateactiontracker.org/global/emissions-pathways/" target="_blank" rel="noopener">Climate Action Tracker</a> (November 2026 update; shaded bands show its high and low estimates, lines show the middle). The country figures are scaled by up to about 3% so that they add up to its global total, which the scenarios continue from, and every scenario starts from the last past value. Warming is its median estimate of the rise above pre-industrial levels in 2100 (it has no estimate for the “no further action” line); the Paris-aligned pathway overshoots to about +${(G.cat.temp || {paris:{}}).paris.peak || 1.7}°C around mid-century before coming back down. The Paris-aligned pathway is its 2026 benchmark, which reflects that global emissions have not yet peaked and that overshooting 1.5°C is now unavoidable; its earlier, steeper 1.5°C pathway was retired in 2026. The pledges scenario adds net zero targets in submitted long-term strategies. “No further action” is a simple extension of the 2014–2024 trend (${SC.slope >= 0 ? '+' : '−'}${Math.abs(SC.slope).toFixed(2)} Gt a year), made for this prototype and not a Climate Action Tracker scenario. © 2026 Climate Analytics and NewClimate Institute, used with credit for non-commercial purposes.</p></div>`;
}

function glRegionTip(k){
  const {G, x0} = window.__gl, name = G.names[k], R = (G.reg || {})[name], j = x0 === 1850 ? 0 : 1, W = G.wc[j], pc = v => (v / W * 100).toFixed(1) + '%';
  if (!R) { const own = G.s[k].slice(x0 - G.y0).reduce((a, b) => a + b, 0); return `<div class="tipms"><b>${esc(name)}</b><div class="mrow"><span class="my">${(own / W * 100).toFixed(1)}%</span><span>of global emissions since ${x0}</span></div></div>`; }
  const rows = R.top.map(([c, a, b]) => `<div class="mrow"><span class="my">${pc(j ? b : a)}</span><span>${esc(c)}</span></div>`).join('') + (R.rest[0] ? `<div class="mrow"><span class="my">${pc(j ? R.rest[2] : R.rest[1])}</span><span>The other ${R.rest[0]} countries</span></div>` : '');
  return `<div class="tipms"><b>${esc(name)}</b><div class="mrow"><span class="my">${pc(R.total[j])}</span><span><b>of global emissions since ${x0}</b></span></div>${rows}<div class="mrow"><span class="my"></span><span style="color:#7a7385;font-size:12px">${R.top.length > 1 ? 'Biggest five emitters, then the rest. ' : ''}Cumulative, share of the world total.</span></div></div>`;
}
function globalWire(st){
  const box = $('#ex-global-body'); if (!box) return;
  const draw = () => { box.innerHTML = globalChartHtml(window.NZG, st); wire(); };
  const wire = () => {
    $$('#gl-to button').forEach(b => b.onclick = () => { st.to = +b.dataset.t; draw(); });
    $$('#gl-from button').forEach(b => b.onclick = () => { st.from = b.dataset.f; draw(); });
    $$('#gl-leg .glr').forEach(sp => { const tip = ev => showTip(glRegionTip(+sp.dataset.g), ev);
      sp.addEventListener('mousemove', tip); sp.addEventListener('mouseleave', hideTip);
      sp.addEventListener('focus', () => { const r = sp.getBoundingClientRect(); showTip(glRegionTip(+sp.dataset.g), {clientX: r.left, clientY: r.bottom}); }); sp.addEventListener('blur', hideTip); });
    const svg = $('#gl-svg'), hit = $('#gl-hit'), vx = $('#gl-x'); if (!svg) return;
    treatyWire(svg, []);
    hit.addEventListener('mousemove', ev => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const {G, SC, x0, x1} = window.__gl, hx = +hit.getAttribute('x'), hw = +hit.getAttribute('width'), yr = Math.round(x0 + Math.max(0, Math.min(1, (p.x - hx) / hw)) * (x1 - x0));
      const X = hx + (yr - x0) / (x1 - x0) * hw; vx.setAttribute('x1', X); vx.setAttribute('x2', X); vx.setAttribute('opacity', .3);
      let rows;
      if (yr <= 2024) { const i = yr - G.y0; rows = G.names.map((n, k) => `<div class="mrow"><span class="my" style="color:#7a7385">${G.s[k][i].toFixed(1)}</span><span>${esc(n)}</span></div>`).join('') + `<div class="mrow"><span class="my">${G.world[i].toFixed(1)}</span><span><b>Global total</b> (Gt)</span></div>`; }
      else { const j = yr - 2024; rows = ['paris', 'ndc', 'pledges', 'pol', 'none'].map(k => { const v = SC[k].mid[j]; return v == null ? '' : `<div class="mrow"><span class="my" style="color:${GL_SCN[k][0]}">${v.toFixed(1)}</span><span>${esc(GL_SCN[k][1])}</span></div>`; }).join(''); }
      showTip(`<div class="tipms"><b>${yr}</b>${rows}</div>`, ev);
    });
    hit.addEventListener('mouseleave', () => { hideTip(); vx.setAttribute('opacity', 0); });
  };
  draw();
}
function renderList(){
  const xs = filtered(), per = 25, pages = Math.max(1, Math.ceil(xs.length / per)); EX.page = Math.min(EX.page, pages - 1);
  const rows = xs.slice(EX.page * per, EX.page * per + per);
  const cols = [['name','Name'],['where', EX.type === 'company' ? 'Country · sector' : EX.type === 'country' ? 'Region' : 'Country'],['target','Target'],['level','How firm?'],['interim','Next milestone'],['score','Credibility checks'],['size', EX.type === 'company' ? 'Revenue' : 'Population']];
  const ar = k => EX.sort === k ? `<span class="ar">${EX.dir > 0 ? '▲' : '▼'}</span>` : '<span class="ar">⇅</span>';
  $('#ex-out').innerHTML = `<p class="muted" style="margin:0 0 8px">${fmt(xs.length)} ${TYPE[EX.type][1].toLowerCase()} match. ${EX.type==='company' ? 'Includes private companies, which the headline count leaves out.' : ''}</p>
  <div class="tablewrap"><table class="list"><thead><tr>${cols.map(([k,l]) => `<th data-k="${k}" scope="col" aria-sort="${EX.sort===k ? (EX.dir>0?'ascending':'descending') : 'none'}">${l}${ar(k)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(e => { const cs = checks(e), t = tally(cs), iy = iyear(e), hasI = e.it && e.it !== 'No target';
    return `<tr class="rowlink" data-href="#/e/${e.s}"><td><a class="nm" href="#/e/${e.s}">${e.t==='country' ? flag(e.a2) + ' ' : ''}${esc(e.n)}</a></td><td>${esc(where(e))}</td><td>${esc(targetPhrase(e))}</td><td>${pill(e)}</td><td class="ms" data-s="${e.s}"${hasI ? ' tabindex="0"' : ''}>${hasI ? esc((e.ip ? e.ip + '% cut' : 'Target') + (iy ? ' by ' + iy : '')) + ((() => { const L = msList(e); return L.length > 1 || (e.ms || []).length > 1 ? ' <span class="more">+more</span>' : ''; })()) : '<span class="muted">None</span>'}</td>
    <td class="chk" data-s="${e.s}"${isNZ(e) ? ' tabindex="0"' : ''}>${isNZ(e) ? `<span class="dots9">${cs.map(c => ICON[c.v]).join('')}</span><span class="score">${t.yes}/${cs.length}</span>` : '<span class="muted">n/a</span>'}</td>
    <td>${e.rev ? money(e.rev) : e.pop ? people(e.pop) : '<span class="muted">n/a</span>'}</td></tr>`; }).join('') || `<tr><td colspan="7" class="empty">Nothing matches these filters.</td></tr>`}</tbody></table></div>
  <div class="pager"><span>Page ${EX.page + 1} of ${pages}</span><span class="flex"><span class="muted ckkey">Checks key: <span>${ICON.yes} yes</span><span>${ICON.part} partly</span><span>${ICON.no} no</span><span>${ICON.unk} unknown</span></span><button class="btn btn-ghost btn-sm" id="pg-prev" ${EX.page?'':'disabled'}>← Previous</button><button class="btn btn-ghost btn-sm" id="pg-next" ${EX.page < pages-1 ? '' : 'disabled'}>Next →</button></span></div>`;
  wireChecksTip($('#ex-out')); wireMsTip($('#ex-out'));
  { const g = $('#ex-global'); if (g) { g.hidden = EX.type !== 'country'; if (EX.type === 'country' && !g.dataset.ready) { g.dataset.ready = '1'; loadGlobal().then(G => { if (G) globalWire({to: 2050, from: '1850'}); }); } } }
  $$('#ex-out th').forEach(th => th.onclick = () => { const k = th.dataset.k; EX.dir = EX.sort === k ? -EX.dir : 1; EX.sort = k; renderList(); });
  $('#pg-prev').onclick = () => { EX.page--; renderList(); };
  $('#pg-next').onclick = () => { EX.page++; renderList(); };
}
function checksTipHtml(e){
  const cs = checks(e), t = tally(cs);
  return `<div class="tipchecks"><b>${esc(e.n)}: ${t.yes} of ${cs.length} credibility checks met</b>${cs.map(c => `<div class="tc">${ICON[c.v]}<span>${esc(c.q.replace(/\?$/, ''))}<em> · ${VLAB[c.v]}</em></span></div>`).join('')}<span class="k" style="font-size:12.5px">Click the row for the full profile</span></div>`;
}
function msList(e){
  const y = new Map(), iy = iyear(e);
  (e.ms || []).forEach(([yr, l]) => { if (yr >= NOW) { if (!y.has(yr)) y.set(yr, []); if (!y.get(yr).includes(l)) y.get(yr).push(l); } });
  if (!y.size && e.it && e.it !== 'No target' && iy) y.set(iy, [e.ip ? e.ip + '% cut' : 'Target']);
  return [...y.entries()].sort((a, b) => a[0] - b[0]).map(([yr, ls]) => [yr, ls.length > 1 ? ls.slice(0, 3).map(l => l.replace(' cut', '')).join(', ') + ' cut' : ls[0]]);
}
function msTipHtml(e){
  const L = msList(e), end = e.y && isNZ(e) ? [e.y, targetPhrase(e)] : null;
  const rows = L.map(([yr, l], i) => `<div class="mrow"><span class="my">${yr}</span><span>${esc(l)}${i === 0 ? '<em> · next</em>' : ''}</span></div>`).join('')
    + (end ? `<div class="mrow end"><span class="my">${esc(end[0])}</span><span>${esc(end[1])}<em> · end target</em></span></div>` : '');
  return `<div class="tipms"><b>${esc(e.n)}: milestones</b>${rows}</div>`;
}
function wireMsTip(root){
  $$('td.ms[tabindex]', root).forEach(td => { const e = BY[td.dataset.s];
    td.addEventListener('mousemove', ev => showTip(msTipHtml(e), ev));
    td.addEventListener('mouseleave', hideTip);
    td.addEventListener('focus', () => { const r = td.getBoundingClientRect(); showTip(msTipHtml(e), {clientX:r.left, clientY:r.bottom}); });
    td.addEventListener('blur', hideTip); });
}
function wireChecksTip(root){
  $$('td.chk', root).forEach(td => { const e = BY[td.dataset.s]; if (!isNZ(e)) return;
    td.addEventListener('mousemove', ev => showTip(checksTipHtml(e), ev));
    td.addEventListener('mouseleave', hideTip);
    td.addEventListener('focus', () => { const r = td.getBoundingClientRect(); showTip(checksTipHtml(e), {clientX:r.left, clientY:r.bottom}); });
    td.addEventListener('blur', hideTip); });
}
document.addEventListener('click', ev => { const tr = ev.target.closest('tr[data-href]'); if (tr && !ev.target.closest('a,button')) { hideTip(); location.hash = tr.dataset.href; } });
function exportCSV(){
  const xs = filtered(), q = s => `"${String(s ?? '').replace(/"/g,'""')}"`;
  const head = ['Name','Type','Country','Region','Target','Target year','Commitment','Raw status','Interim target','Interim year','Interim % cut','Checks met','Checks partly','Checks unknown','Profile URL'];
  const lines = xs.map(e => { const cs = checks(e), t = tally(cs); return [e.n, TYPE[e.t][0], e.cn, e.g, targetWord(e), year(e)||'', level(e).label, e.st||'', e.it||'', iyear(e)||'', e.ip||'', isNZ(e)?t.yes:'', isNZ(e)?t.part:'', isNZ(e)?t.unk:'', official(e)].map(q).join(','); });
  const blob = new Blob([head.join(',') + '\n' + lines.join('\n')], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `net-zero-tracker-${EX.type}.csv`; a.click();
  toast(`Exported ${fmt(xs.length)} rows`);
}

/* ---------- PROFILE ---------- */
function summaryText(e){
  const L = level(e), y = year(e), iy = iyear(e), name = Nm(e), hasI = e.it && e.it !== 'No target';
  const s = [];
  if (!hasAnyTarget(e)) s.push(`${name} has <b>no net zero target</b> and no other emissions target that we could find.`);
  else if (!isNZ(e)) s.push(`${name} has <b>no net zero target</b>. It does have a narrower goal: <b>${esc(targetPhrase(e).toLowerCase())}</b>.`);
  else {
    const how = {1:'is still only being discussed', 2:'has been announced as a pledge', 3:e.t==='company' ? 'is part of official company strategy' : 'is set out in a policy document', 4:'is written into law', 5:`is reported as already achieved${e.st && e.st.includes('self') ? ' (self-declared, not independently checked)' : ' (externally validated)'}`}[Math.floor(L.k)] || 'has an unclear status';
    s.push(`${name} aims for <b>${esc(targetWord(e).toLowerCase())}${y ? ' by ' + y : ''}</b>${y && y > NOW ? `, ${y - NOW} years from now` : ''}. The target ${how}${e.sd && L.k>=1 ? ` (since ${e.sd})` : ''}.`);
  }
  if (hasI) s.push(`Its ${iy && iy < NOW ? 'most recent' : 'next'} milestone is ${e.ip ? `a <b>${e.ip}% cut</b>` : '<b>' + esc(e.it.toLowerCase()) + '</b>'}${iy ? ` by <b>${iy}</b>` : ''}${e.ib ? ` compared with ${e.ib}` : ''}.`);
  else if (isNZ(e)) s.push(`It has <b>no interim milestone</b>, so there is no way to check progress before the end date.`);
  if (isNZ(e)) {
    const cs = checks(e), t = tally(cs);
    const gaps = cs.filter(c => c.v === 'no').map(c => shortGap[c.id]).filter(Boolean);
    s.push(`It meets <b>${t.yes} of ${cs.length}</b> credibility checks${gaps.length ? `. Main gaps: ${gaps.slice(0,3).join('; ')}` : ''}${t.unk ? `. ${t.unk} could not be assessed from public information` : ''}.`);
  }
  return s.join(' ');
}
const shortGap = {lock:'the target is not locked in', interim:'no near-term milestone', gas:'not all gases covered', s3:'supply-chain emissions left out', cons:'imported emissions not counted', plan:'no detailed plan', rep:'no yearly reporting', acc:'no one formally accountable', offsets:'relies on offsets without quality rules', rem:'cuts and removals not separated'};

function timelineSVG(e){
  const y = year(e), iy = iyear(e), start = 2015;
  const end = Math.max(2070, (y||0) + 5);
  const W = innerWidth < 640 ? 460 : 900, x = v => 30 + (v - start) / (end - start) * (W - 60);
  const ticks = []; for (let t = 2020; t <= end; t += 10) ticks.push(t);
  const close = y && hasAnyTarget(e) && Math.abs(x(y) - x(NOW)) < 130 * W / 900, tAn = !close ? 'middle' : y >= NOW ? 'start' : 'end', nAn = !close ? 'middle' : y >= NOW ? 'end' : 'start';
  const mk = (v, lab, sub, col, up, an = 'middle') => `<g><line x1="${x(v)}" x2="${x(v)}" y1="${up?40:60}" y2="${up?60:80}" stroke="${col}" stroke-width="2"/><circle cx="${x(v)}" cy="60" r="8" fill="${col}" stroke="#fff" stroke-width="3"/><text x="${x(v) + (an === 'end' ? -12 : an === 'start' ? 12 : 0)}" y="${up?22:104}" text-anchor="${an}" font-size="15" font-weight="700" fill="${col}">${lab}</text><text x="${x(v) + (an === 'end' ? -12 : an === 'start' ? 12 : 0)}" y="${up?36:120}" text-anchor="${an}" font-size="12.5" fill="#5f5869">${sub}</text></g>`;
  return `<svg viewBox="0 0 ${W} 130" role="img" aria-label="Timeline: today ${NOW}${iy ? ', milestone ' + iy : ''}${y ? ', target ' + y : ''}">
    <line x1="${x(start)}" x2="${x(end)}" y1="60" y2="60" stroke="#dcdcdc" stroke-width="6" stroke-linecap="round"/>
    ${y && isNZ(e) ? `<line x1="${x(NOW)}" x2="${x(y)}" y1="60" y2="60" stroke="#b2d49b" stroke-width="6" stroke-linecap="round"/>` : ''}
    ${ticks.map(t => `<text x="${x(t)}" y="${y && Math.abs(t-y)<(W < 600 ? 7 : 4) || iy && Math.abs(t-iy)<(W < 600 ? 7 : 4) || Math.abs(t-NOW)<(W < 600 ? 7 : 4) ? -100 : 66+28}" text-anchor="middle" font-size="12" fill="#9a94a3">${t}</text>`).join('')}
    ${mk(NOW, 'Today', String(NOW), '#271039', true, nAn)}
    ${iy && iy >= start ? mk(iy, 'Milestone ' + iy, e.ip ? e.ip + '% cut' : 'interim target', '#c27a00', false) : ''}
    ${y && hasAnyTarget(e) ? mk(y, (isNZ(e) ? 'Net zero ' : 'Target ') + y, y > NOW ? (y - NOW) + ' years away' : 'target year', '#3B7CC3', true, tAn) : ''}
  </svg>`;
}

/* ---------- EMISSIONS HISTORY (countries: Our World in Data 1850-; cities and regions: EDGAR v8.0 1970-2022) ---------- */

// Kyoto Protocol (adopted 1997) and Paris Agreement (adopted 2015) markers for the emissions charts
function pmarks(x, xa, xb, T, bottom, part){
  const L = [[1997, 'kyoto', 'Kyoto Protocol, 1997', 'end'], [2015, 'paris', 'Paris Agreement, 2015', 'start']].filter(([yr]) => yr >= xa && yr <= xb);
  if (part === 'labels') {
    // labels sit in a strip above the plot so they never touch the data; the second goes a row higher if the two would collide
    const narrow = x(xb) - x(xa) < 520, right = x(xb) + 30, lab = [];
    L.forEach(([yr, k, l, a0]) => { const t = narrow ? l.replace(' Protocol', '').replace(' Agreement', '') : l, w = t.length * 6.3;
      let a = a0; if (a === 'start' && x(yr) + 6 + w > right) a = 'end'; if (a === 'end' && x(yr) - 6 - w < x(xa) - 40) a = 'start';
      const lx0 = a === 'start' ? x(yr) + 6 : x(yr) - 6 - w, dy = lab.some(o => !(lx0 + w < o.l || lx0 > o.l + o.w)) ? -14 : 0;
      lab.push({yr, k, t, a, l: lx0, w, dy}); });
    return lab.map(({yr, k, t, a, dy}) => `<text class="trl" data-tr="${k}" tabindex="0" x="${x(yr) + (a === 'start' ? 6 : -6)}" y="${T - 6 + dy}" text-anchor="${a}" font-size="11.5" font-weight="600" fill="#2f7a3f" style="cursor:help;text-decoration:underline dotted">${t}</text>`).join('');
  }
  if (part === 'labels-old') return L.map(([yr, k, l, a]) => `<text class="trl" data-tr="${k}" tabindex="0" x="${x(yr) + (a === 'start' ? 6 : -6)}" y="${T + 11}" text-anchor="${a}" font-size="11.5" font-weight="600" fill="#2f7a3f" paint-order="stroke" stroke="#fff" stroke-width="3" style="cursor:help;text-decoration:underline dotted">${l}</text>`).join('');
  return L.map(([yr]) => `<line x1="${x(yr)}" x2="${x(yr)}" y1="${T}" y2="${bottom}" stroke="#2f8a4c" stroke-width="1.6" stroke-dasharray="4 4" opacity=".75"/>`).join('');
}
const TREATY = {
  kyoto: ['Kyoto Protocol', 'Adopted in December 1997 and in force since 2005. It was the first treaty to set binding emission-reduction targets, but only for developed countries. Developing countries could join without binding targets.'],
  paris: ['Paris Agreement', 'Adopted in December 2015 and in force since November 2016. Every country sets its own national climate plan (an NDC) to keep warming well below 2°C and pursue 1.5°C, and updates it every five years.']
};
function treatyLine(e, key){
  const row = (window.NZTR || {})[e.c]; if (!row) return '';
  const [st, yr] = key === 'paris' ? row.p : row.k, T = TREATY[key][0], isC = e.t === 'country', cname = isC ? nm(e) : (e.cn || e.c);
  const who = isC ? Nm(e) : e.t === 'company' ? `${e.n} is based in ${cname}, which` : `${e.n} is in ${cname}, which`;
  const what = st === 'party' ? `is a party to the ${T} (since ${yr})`
    : st === 'withdrawn' ? (key === 'paris' ? `joined the ${T} in 2016 but withdrew, with effect from January ${yr}, so it is not currently a party` : `was a party to the ${T} but withdrew in ${yr}`)
    : st === 'signed' ? `signed the ${T} in ${yr} but has not ratified it, so it is not a party`
    : `is not a party to the ${T}`;
  return `${who} ${what}.`;
}
function treatyTip(key, ents){
  const lines = (ents || []).map(e => treatyLine(e, key)).filter(Boolean);
  return `<div class="tipms"><b>${TREATY[key][0]}</b><div class="trtxt">${esc(TREATY[key][1])}</div>${lines.map(l => `<div class="trtxt trst">${esc(l)}</div>`).join('')}</div>`;
}
function treatyWire(svg, ents){
  if (!svg) return;
  svg.addEventListener('mousemove', ev => { const t = ev.target.closest && ev.target.closest('.trl'); if (t) showTip(treatyTip(t.dataset.tr, typeof ents === 'function' ? ents() : ents), ev); });
  svg.addEventListener('mouseout', ev => { if (ev.target.closest && ev.target.closest('.trl')) hideTip(); });
}
function loadComp(){ return window.NZCE ? Promise.resolve(window.NZCE) : new Promise(res => { const t = document.createElement('script'); t.src = 'compemis.js?v=20261120e'; t.onload = () => res(window.NZCE); t.onerror = () => res(null); document.head.appendChild(t); }); }
function loadEmis(){ return Promise.all([loadEmis0(), loadComp()]).then(a => a[0]); }
function loadEmis0(){ return window.NZE ? Promise.resolve(window.NZE) : new Promise(res => { const t = document.createElement('script'); t.src = 'emis.js?v=20261120bz'; t.onload = () => res(window.NZE); t.onerror = () => res(null); document.head.appendChild(t); }); }
/* ---------- WARMING STRIPES (Berkeley Earth High Resolution Dataset, April 2026, land air temperature; CC BY-NC 4.0) ---------- */
function loadStripes(){ return window.NZS ? Promise.resolve(window.NZS) : new Promise(res => { const t = document.createElement('script'); t.src = 'stripes.js?v=' + FX_V; t.onload = () => res(window.NZS); t.onerror = () => res(null); document.head.appendChild(t); }); }
const STR_BLUE = ['#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'], STR_RED = ['#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'];
function stripesHtml(e){
  const S = window.NZS, a = S && S.d[e.s]; if (!a) return null;
  const y0 = S.y0, n = a.length, v = a.map(x => x == null ? null : x / 100), yr = i => y0 + i;
  const sl = (A, B) => v.slice(A - y0, B - y0 + 1).filter(x => x != null), mean = xs => xs.reduce((p, c) => p + c, 0) / xs.length;
  const ref = sl(1971, 2000); if (ref.length < 20) return null;
  const base = mean(ref), hist = sl(1901, 2000), sd = Math.sqrt(mean(hist.map(x => (x - mean(hist)) ** 2))) || 0.5, range = 2.6 * sd;
  const col = x => { if (x == null) return '#ebe8ef'; const z = (x - base) / range, k = Math.min(7, Math.floor(Math.min(1, Math.abs(z)) * 8)); return z < 0 ? STR_BLUE[k] : STR_RED[k]; };
  const W = 900, H = 150, bw = W / n, rects = v.map((x, i) => `<rect x="${(i * bw).toFixed(2)}" y="0" width="${(bw + 0.6).toFixed(2)}" height="${H}" fill="${col(x)}"/>`).join('');
  const ticks = [1850, 1900, 1950, 2000, 2025].filter(t => t >= y0 && t <= y0 + n - 1).map(t => `<text x="${Math.min(W - 14, Math.max(14, (t - y0 + 0.5) * bw))}" y="${H + 20}" text-anchor="middle" font-size="12.5" fill="#7a7385">${t}</text>`).join('');
  const last10 = sl(y0 + n - 10, y0 + n - 1), pre = sl(1850, 1900), m1951 = sl(1951, 1980);
  const d1951 = last10.length >= 8 && m1951.length >= 20 ? mean(last10) - mean(m1951) : null, dPre = last10.length >= 8 && pre.length >= 30 ? mean(last10) - mean(pre) : null;
  const UU = fxU(e), sg = x => (x >= 0 ? '+' : '−') + Math.abs(x * UU.k).toFixed(1) + UU.u;
  const first = v.findIndex(x => x != null);
  const ranked = v.map((x, i) => [yr(i), x]).filter(p => p[1] != null).sort((a, b) => b[1] - a[1]).slice(0, 10), hot = ranked.length === 10 ? ranked.filter(p => p[0] >= 2015).length : null;
  const facts = [hot != null ? ['10 hottest years on record', `${hot} since 2015`] : null, d1951 != null ? ['Last 10 years', `${sg(d1951)} vs 1951–1980`] : null, dPre != null ? ['Since the 1850s', `${sg(dPre)} vs 1850–1900`] : null, first > 0 ? ['Record starts', String(yr(first))] : null].filter(Boolean).map(([k, t]) => `<div><span>${k}</span><b>${t}</b></div>`).join('');
  return {facts, hot, svg: `<svg viewBox="0 0 ${W} ${H + 28}" id="str-svg" role="img" aria-label="Warming stripes for ${esc(e.n)}, ${yr(0)} to ${yr(n - 1)}. Each stripe is one year; blue years were cooler and red years warmer than the 1971–2000 average." style="width:100%;height:auto;display:block;border-radius:6px">${rects}${ticks}<rect id="str-hit" x="0" y="0" width="${W}" height="${H}" fill="transparent"/><line id="str-x" y1="0" y2="${H}" stroke="#271039" stroke-width="2" opacity="0"/></svg>`, v, y0, n, base, W, d1951, k: UU.k, u: UU.u};
}
function stripesWire(e, st){
  const svg = $('#str-svg'), hit = $('#str-hit'), ln = $('#str-x'); if (!svg) return;
  const mv = ev => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()), i = Math.max(0, Math.min(st.n - 1, Math.floor(p.x / (st.W / st.n)))), x = st.v[i];
    ln.setAttribute('x1', (i + 0.5) * st.W / st.n); ln.setAttribute('x2', (i + 0.5) * st.W / st.n); ln.setAttribute('opacity', .55);
    showTip(`<div class="tipms"><b>${st.y0 + i}</b>${x == null ? '<div class="mrow"><span class="my"></span><span>No usable temperature record</span></div>' : `<div class="mrow"><span class="my" style="color:${x >= st.base ? '#a50f15' : '#08519c'}">${(x >= st.base ? '+' : '−') + (Math.abs(x - st.base) * st.k).toFixed(1)}${st.u}</span><span>vs the 1971–2000 average</span></div><div class="mrow"><span class="my" style="color:#7a7385">${(x >= 0 ? '+' : '−') + (Math.abs(x) * st.k).toFixed(1)}${st.u}</span><span>vs 1951–1980</span></div>`}</div>`, ev); };
  hit.addEventListener('mousemove', mv); hit.addEventListener('mouseleave', () => { hideTip(); ln.setAttribute('opacity', 0); });
}

/* ---------- EFFECTS of climate change: stripes, projections, hot days, rain, sea level, disasters ---------- */
const FX_V = '20261121zi';  // bump whenever stripes.js, fx.js, sea.js or disasters.js change
function loadScr(src, key){ return window[key] ? Promise.resolve(window[key]) : new Promise(res => { const t = document.createElement('script'); t.src = src + '?v=' + FX_V; t.onload = () => res(window[key] || null); t.onerror = () => res(null); document.head.appendChild(t); }); }
const F_LANDS = new Set(['USA', 'BHS', 'BLZ', 'CYM', 'PLW', 'FSM', 'MHL', 'LBR', 'PRI', 'GUM', 'VIR', 'ASM', 'MNP']);   // places that use Fahrenheit
const fxU = e => F_LANDS.has(e.c) ? {k: 1.8, u: '°F', th: '95°F', abs: c => c * 1.8 + 32} : {k: 1, u: '°C', th: '35°C', abs: c => c};
const FX_SCN = [['Low emissions', 'SSP1-2.6', '#2f8a4c', 'roughly the “all pledges met” path'], ['Middle emissions', 'SSP2-4.5', '#c27a00', 'roughly where today’s policies lead'], ['High emissions', 'SSP3-7.0', '#c8331f', 'more warming than today’s policies']];
const fxSign = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
function fxPlace(e){ return e.c === 'EUU' ? 'the European Union' : e.t === 'country' ? nm(e) : e.n; }
function fxNiceScale(lo, hi, n = 5){ const span = (hi - lo) || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), st = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= raw), a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st, t = []; for (let v = a; v <= b + 1e-9; v += st) t.push(+v.toFixed(6)); return {a, b, t}; }
// centered moving mean over w years (needs 60% of the window)
function fxMean(pts, w){ const m = new Map(pts.filter(p => p[1] != null)), h = (w - 1) / 2; return pts.map(([x]) => { let t = 0, c = 0; for (let k = -h; k <= h; k++) { const v = m.get(x + k); if (v != null) { t += v; c++; } } return c >= Math.ceil(w * .6) ? [x, t / c] : null; }).filter(Boolean); }
// light 3-point smoothing for the 5-year projection samples (end points kept)
function fxSoft(pts){ return pts.map((p, i) => i === 0 || i === pts.length - 1 || pts[i - 1][1] == null || pts[i + 1][1] == null || p[1] == null ? p : [p[0], .25 * pts[i - 1][1] + .5 * p[1] + .25 * pts[i + 1][1]]); }
// smooth monotone curve through pixel points
function fxCurve(pts){
  const n = pts.length, f = v => v.toFixed(1); if (n < 3) return pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('');
  const dx = [], m = []; for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); m.push((pts[i + 1][1] - pts[i][1]) / dx[i]); }
  const t = [m[0]]; for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2); t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; } const a = t[i] / m[i], b = t[i + 1] / m[i], q = a * a + b * b; if (q > 9) { const k = 3 / Math.sqrt(q); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`; for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += `C${f(pts[i][0] + h)} ${f(pts[i][1] + t[i] * h)} ${f(pts[i + 1][0] - h)} ${f(pts[i + 1][1] - t[i + 1] * h)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`; } return d;
}
function fxBlock(id, title, lede, svg, src){ return `<div class="fxblock" id="fxb-${id}"><div class="shead"><h3>${title}</h3>${shareBarHtml('sh-' + id)}</div><p class="muted mt0" style="margin-bottom:8px">${lede}</p><div class="card emis">${svg}<p class="muted emis-src">${src}</p></div></div>`; }
// a line chart with a hover read-out; series: [{name,color,pts:[[x,y]],w,op,dash}]
function fxLine(id, o){
  const W = o.W || 900, H = o.H || 290, L = o.W ? 46 : (o.note ? 72 : 58), R = 18, T = 14, B = 32, ys = o.series.flatMap(s => s.pts.map(p => p[1]).filter(v => v != null)), sc = fxNiceScale(Math.min(o.zero === false ? Infinity : 0, ...ys), Math.max(o.zero === false ? -Infinity : 0, ...ys));
  const x = v => L + (v - o.x0) / (o.x1 - o.x0) * (W - L - R), y = v => T + (1 - (v - sc.a) / (sc.b - sc.a)) * (H - T - B);
  const path = pts => { let d = '', pen = false; pts.forEach(p => { if (p[1] == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`; pen = true; }); return d; };
  const xt = []; const step = (o.x1 - o.x0) > 120 ? 25 : (o.x1 - o.x0) > 60 || (o.W && o.W < 600 && (o.x1 - o.x0) > 40) ? 10 : 5; for (let t = Math.ceil(o.x0 / step) * step; t <= o.x1; t += step) xt.push(t);
  window.__fx = window.__fx || {}; window.__fx[id] = {o, x0: o.x0, x1: o.x1, L, R, W};
  return `<svg viewBox="0 0 ${W} ${H}" id="${id}-svg" role="img" aria-label="${esc(o.aria)}" style="width:100%;height:auto;display:block">
    ${sc.t.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 && o.zero !== false ? '#9a94a3' : '#ece8ef'}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="#7a7385">${o.yfmt ? o.yfmt(t) : t}</text>`).join('')}
    ${xt.map(t => `<text x="${x(t)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="#7a7385">${t}</text>`).join('')}
    ${(o.bands || []).map(b => `<rect x="${x(b[0])}" y="${T}" width="${x(b[1]) - x(b[0])}" height="${H - T - B}" fill="${b[2]}" opacity=".5"/>`).join('')}
    ${o.series.map(s => `<path d="${s.smooth ? fxCurve(s.pts.filter(p => p[1] != null).map(p => [x(p[0]), y(p[1])])) : path(s.pts)}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2.6}" ${s.dash ? 'stroke-dasharray="6 5"' : ''} opacity="${s.op || 1}" stroke-linejoin="round"/>`).join('')}
    ${o.note ? `<text transform="rotate(-90 14 ${((T + H - B) / 2).toFixed(1)})" x="14" y="${((T + H - B) / 2).toFixed(1)}" text-anchor="middle" font-size="12.5" fill="#7a7385">${esc(o.note)}</text>` : ''}
    <line id="${id}-x" y1="${T}" y2="${H - B}" stroke="#271039" opacity="0"/><rect id="${id}-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/></svg>`;
}
function fxLineWire(id){
  const c = window.__fx[id], svg = $('#' + id + '-svg'), hit = $('#' + id + '-hit'), ln = $('#' + id + '-x'); if (!svg || !c) return;
  hit.addEventListener('mousemove', ev => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()), yr = Math.round(c.x0 + Math.max(0, Math.min(1, (p.x - c.L) / (c.W - c.L - c.R))) * (c.x1 - c.x0)), X = c.L + (yr - c.x0) / (c.x1 - c.x0) * (c.W - c.L - c.R);
    ln.setAttribute('x1', X); ln.setAttribute('x2', X); ln.setAttribute('opacity', .3);
    const rows = c.o.series.map(s => { let best = null; s.pts.forEach(q => { if (q[1] != null && (best == null || Math.abs(q[0] - yr) < Math.abs(best[0] - yr))) best = q; }); return best && Math.abs(best[0] - yr) <= (c.o.snap || 3) ? `<div class="mrow"><span class="my" style="color:${s.color}">${c.o.vfmt(best[1])}</span><span>${esc(s.name)}</span></div>` : ''; }).join('');
    showTip(`<div class="tipms"><b>${yr}</b>${rows || '<div class="mrow"><span class="my"></span><span>No data</span></div>'}</div>`, ev); });
  hit.addEventListener('mouseleave', () => { hideTip(); ln.setAttribute('opacity', 0); });
}
function fxTipWire(svgId){ const svg = $('#' + svgId); if (!svg) return; svg.addEventListener('mousemove', ev => { const t = ev.target.closest('[data-tip]'); if (!t) { hideTip(); return; } showTip(t.getAttribute('data-tip'), ev); }); svg.addEventListener('mouseleave', hideTip); }
function fxShare(id, e, name, title, text){ shareWire('sh-' + id, {url: () => location.href.split('#')[0] + '#/e/' + e.s, name: name + '-' + e.s, title: () => title, svg: () => $('#' + id + '-svg'), text: () => text}); }
const FX_SRC_CCKP = 'World Bank Climate Change Knowledge Portal, CMIP6 climate models (median of the models, 0.25° grid), averaged over the place’s outline or taken at the city’s location. Each line is a different emissions pathway: low (SSP1-2.6), middle (SSP2-4.5) and high (SSP3-7.0). Projections are not forecasts: they show what the models say each path leads to.';

async function fxRender(e){
  const body = $('#fx-body'); if (!body) return;
  let S, F, SL, DS; try { [S, F, SL, DS] = await Promise.all([loadStripes(), loadScr('fx.js', 'NZF'), loadScr('sea.js', 'NZSL'), loadScr('disasters.js', 'NZD')]); } catch (err) { console.error(err); }
  if (location.hash.indexOf('/e/' + e.s) < 0) return;
  const P = fxPlace(e), blocks = [], wires = [];
  let G = null, dv = null;   // set inside the sections, used for the sub-title
  // 1. stripes
  try {
  const r = stripesHtml(e);
  if (r) { blocks.push(`<div class="fxblock" id="fxb-str"><div class="shead"><h3>Warming stripes</h3>${shareBarHtml('sh-str')}</div><p class="muted mt0" style="margin-bottom:8px">How the average temperature in ${esc(e.t === 'region' ? placeName(e) : P)} has changed since ${r.y0}. Each stripe is one year: blue years were cooler than the 1971–2000 average, red years warmer.</p><div class="card emis"><div class="emis-facts">${r.facts}</div>${r.svg}<p class="muted emis-src"><b>Source:</b> <a href="https://berkeleyearth.org/data/" target="_blank" rel="noopener">Berkeley Earth</a> High Resolution Dataset (April 2026), land air temperature on a 0.25° grid (about 25 km), CC BY-NC 4.0. ${e.t === 'city' ? 'This is the temperature at the city’s location, not for a wider area.' : `This averages the land inside the ${regTerm(e)[0]}’s outline.`} Light grey stripes are years with no usable record; the early decades rest on few weather stations and are less certain. The colours follow the “warming stripes” by climate scientist <a href="https://showyourstripes.info" target="_blank" rel="noopener">Ed Hawkins</a>: the scale runs ±2.6 standard deviations around the 1971–2000 average.</p></div></div>`);
    wires.push(() => { stripesWire(e, r); const d1 = r.d1951; fxShare('str', e, 'warming-stripes', 'Warming stripes: ' + P, `${P} has warmed ${d1 != null ? fxSign(d1 * r.k) + r.u + ' in the last 10 years compared with 1951–1980' : 'since 1850'}${r.hot != null ? `, and ${r.hot} of its 10 hottest years on record have come since 2015` : ''}. Each stripe is one year, from 1850 to 2025. #ClimateAction`); }); }
  } catch (err) { console.error(err); }
  // 2. temperature ahead
  try {
  const T = F && F.t[e.s];
  if (T) {
    const obs = S && S.d[e.s], base0 = (() => { if (!obs) return null; const v = obs.slice(1995 - S.y0, 2015 - S.y0).filter(x => x != null); return v.length >= 15 ? v.reduce((a, b) => a + b, 0) / v.length : null; })();
    const series = []; let off = 0;
    if (base0 != null) { const raw = obs.map((v, i) => [S.y0 + i, v == null ? null : (v - base0) / 100]).filter(p => p[0] >= 1950), sm = fxMean(raw, 11).filter(p => p[0] <= S.y1 - 5);
      series.push({name: 'Measured, each year', color: '#9a94a3', w: 1.1, op: .55, pts: raw}); series.push({name: 'Measured, 11-year average', color: '#3d3647', w: 2.8, smooth: true, pts: sm});
      // line the model curves up with the measured average where they meet (2020), so the two parts join
      const a0 = sm.find(p => p[0] === F.years[0]), m0 = FX_SCN.reduce((t, _, k) => t + (T[k + 1][0] || 0), 0) / FX_SCN.length / 10; if (a0) off = a0[1] - m0; }
    FX_SCN.forEach((sc, k) => series.push({name: sc[0] + ' (' + sc[1] + ')', color: sc[2], smooth: true, pts: fxSoft(F.years.map((y, i) => [y, T[k + 1][i] == null ? null : T[k + 1][i] / 10 + off]))}));
    const U = fxU(e); if (U.k !== 1) series.forEach(s => { s.pts = s.pts.map(p => [p[0], p[1] == null ? null : p[1] * U.k]); });
    const end = FX_SCN.map((_, k) => (T[k + 1][T[k + 1].length - 1] / 10 + off) * U.k);
    const facts = FX_SCN.map((sc, k) => `<div><span>${sc[0]}, by 2100</span><b style="color:${sc[2]}">${fxSign(end[k])}${U.u}</b></div>`).join('') + `<div><span>${esc(P)} 1995–2014 average</span><b>${U.abs(T[0] / 10).toFixed(1)}${U.u}</b></div>`;
    const svg = fxLine('fx-t', {x0: 1950, x1: 2100, series, aria: `Projected temperature change for ${P} to 2100 under three emissions paths, compared with the 1995–2014 average`, yfmt: v => fxSign(v, 0) + '°', vfmt: v => fxSign(v) + U.u, snap: 6, note: U.u + ' above the 1995–2014 average', bands: [[2020, 2100, 'rgba(235,232,239,.35)']]});
    const key = FX_SCN.map(sc => `<span><i style="background:${sc[2]};height:4px"></i>${sc[0]} (${sc[1]})</span>`).join('') + (base0 != null ? '<span><i style="background:#3d3647;height:4px"></i>Measured, 11-year average (Berkeley Earth)</span><span><i style="background:#9a94a3;height:2px"></i>Measured, each year</span>' : '');
    blocks.push(fxBlock('fx-t', 'How much warmer could it get?', `Temperature in ${esc(P)} compared with its 1995–2014 average, from measurements up to now and from climate models to 2100.`, `<div class="emis-facts">${facts}</div>${svg}<div class="emis-key">${key}</div>`, `<b>Source:</b> ${FX_SRC_CCKP} Low emissions is roughly the Tracker’s “all pledges met” path, middle is roughly where today’s policies lead, and high is more warming than that. The model curves are lined up with the measured average in 2020 so the two join smoothly.`));
    wires.push(() => { fxLineWire('fx-t'); fxShare('fx-t', e, 'projected-warming', 'Projected warming: ' + P, `${P} could be ${fxSign(end[1])}${U.u} warmer by 2100 than in 1995–2014 on the middle emissions path (${fxSign(end[0])}${U.u} if emissions fall fast, ${fxSign(end[2])}${U.u} on a high path). #ClimateAction`); });
  }
  } catch (err) { console.error(err); }
  // 3. hot days
  try {
  const UH = fxU(e);
  const H = F && F.hd[e.s];
  if (H && H[0] != null) {
    const per = F.periods, now = H[0] / 10, vals = H.slice(1).map(a => a.map(v => v == null ? null : v / 10)), mx = Math.max(now, ...vals.flat().filter(v => v != null));
    if (mx < 1) blocks.push(`<div class="fxblock" id="fxb-fx-h"><div class="shead"><h3>Very hot days</h3></div><div class="card"><p style="margin:0">Days above ${UH.th} are rare in ${esc(P)}: fewer than one a year today, and still fewer than one a year on every path to 2100, according to the climate models.</p></div></div>`);
    else {
      const W = 900, Hh = 290, L = 72, R = 18, Tt = 14, B = 46, sc = fxNiceScale(0, mx * 1.08), y = v => Tt + (1 - v / sc.b) * (Hh - Tt - B), gw = (W - L - R) / (per.length + 1), bw = gw / 4.4;
      const groups = [['1995–2014', [[now, '#8a8394', 'Now']]]].concat(per.map((p, i) => [p, FX_SCN.map((s, k) => [vals[k][i], s[2], s[0]])]));
      const bars = groups.map(([lab, bs], gi) => { const cx = L + gw * (gi + .5), x0 = cx - (bs.length * bw + (bs.length - 1) * 4) / 2; return bs.map(([v, col, nmx], bi) => v == null ? '' : `<rect x="${(x0 + bi * (bw + 4)).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" rx="3" fill="${col}" data-tip="${esc(`<div class="tipms"><b>${esc(nmx)}</b><div class="mrow"><span class="my" style="color:${col}">${v.toFixed(v < 10 ? 1 : 0)}</span><span>days a year above ${UH.th}, ${lab}</span></div></div>`)}"></rect><text x="${(x0 + bi * (bw + 4) + bw / 2).toFixed(1)}" y="${(y(v) - 5).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#4a4358">${v < 10 ? v.toFixed(1) : Math.round(v)}</text>`).join('') + `<text x="${cx}" y="${Hh - 22}" text-anchor="middle" font-size="12.5" fill="#5f5869">${lab}</text>`; }).join('');
      const svg = `<svg viewBox="0 0 ${W} ${Hh}" id="fx-h-svg" role="img" aria-label="Days a year above ${UH.th} in ${esc(P)}: now, and in four future periods under three emissions paths" style="width:100%;height:auto;display:block">${sc.t.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? '#9a94a3' : '#ece8ef'}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="#7a7385">${t}</text>`).join('')}${bars}<text transform="rotate(-90 14 ${((Tt + Hh - B) / 2).toFixed(1)})" x="14" y="${((Tt + Hh - B) / 2).toFixed(1)}" text-anchor="middle" font-size="12.5" fill="#7a7385">days a year above ${UH.th}</text></svg>`;
      const m80 = FX_SCN.map((_, k) => vals[k][3]);
      blocks.push(fxBlock('fx-h', 'More very hot days', `Days a year when the highest temperature reaches ${UH.th} or more in ${esc(P)}: the 1995–2014 average, and what the models say for the coming decades.`, `<div class="emis-facts"><div><span>1995–2014</span><b>${now < 10 ? now.toFixed(1) : Math.round(now)} days a year</b></div>${FX_SCN.map((sc, k) => `<div><span>2080–2099, ${sc[0].toLowerCase()}</span><b style="color:${sc[2]}">${m80[k] < 10 ? m80[k].toFixed(1) : Math.round(m80[k])} days</b></div>`).join('')}</div>${svg}<div class="emis-key">${FX_SCN.map(sc => `<span><i style="background:${sc[2]};height:10px"></i>${sc[0]} (${sc[1]})</span>`).join('')}</div>`, `<b>Source:</b> ${FX_SRC_CCKP} “Hot days” are days when the daily maximum reaches ${UH.th}. The first bar is the models’ own 1995–2014 average, so it can differ from local weather records.`));
      wires.push(() => fxTipWire('fx-h-svg'));
      wires.push(() => fxShare('fx-h', e, 'hot-days', 'Very hot days: ' + P, `${P}: ${now < 10 ? now.toFixed(1) : Math.round(now)} days a year above ${UH.th} in 1995–2014, and about ${m80[1] < 10 ? m80[1].toFixed(1) : Math.round(m80[1])} by 2080–2099 on the middle emissions path (${m80[0] < 10 ? m80[0].toFixed(1) : Math.round(m80[0])} if emissions fall fast, ${m80[2] < 10 ? m80[2].toFixed(1) : Math.round(m80[2])} on a high path). #ClimateAction`));
    }
  }
  } catch (err) { console.error(err); }
  // 4. rain
  try {
  const RN = F && F.p && F.p[e.s];
  if (RN) {
    const series = FX_SCN.map((sc, k) => ({name: sc[0] + ' (' + sc[1] + ')', color: sc[2], smooth: true, pts: fxSoft(F.years.map((y, i) => [y, RN[k][i] == null ? null : RN[k][i] / 10]))}));
    const end = RN.map(a => a[a.length - 1] / 10), lo = Math.min(...end), hi = Math.max(...end), dir = lo > 2 ? 'wetter' : hi < -2 ? 'drier' : 'a mixed picture';
    const svg = fxLine('fx-r', {x0: 2020, x1: 2100, series, aria: `Projected change in yearly rainfall for ${P} to 2100 under three emissions paths`, yfmt: v => fxSign(v, 0) + '%', vfmt: v => fxSign(v) + '%', snap: 5, note: 'change in yearly rainfall vs 1995–2014'});
    blocks.push(fxBlock('fx-r', 'Will it get wetter or drier?', `Change in the total rain and snow that falls in a year in ${esc(P)}, compared with 1995–2014. The models point to ${dir} conditions overall, but rainfall is much harder to project than temperature.`, `<div class="emis-facts">${FX_SCN.map((sc, k) => `<div><span>${sc[0]}, by 2100</span><b style="color:${sc[2]}">${fxSign(end[k], 0)}%</b></div>`).join('')}</div>${svg}<div class="emis-key">${FX_SCN.map(sc => `<span><i style="background:${sc[2]};height:4px"></i>${sc[0]} (${sc[1]})</span>`).join('')}</div>`, `<b>Source:</b> ${FX_SRC_CCKP} Yearly totals hide big changes within the year: rain tends to arrive in heavier bursts with longer dry spells in between. Where the three lines disagree about whether rainfall goes up or down, treat the direction as uncertain.`));
    wires.push(() => { fxLineWire('fx-r'); fxShare('fx-r', e, 'rainfall-change', 'Rainfall change: ' + P, `Climate models suggest yearly rainfall in ${P} could change by ${fxSign(end[1], 0)}% by 2100 on the middle emissions path (${fxSign(end[0], 0)}% if emissions fall fast, ${fxSign(end[2], 0)}% on a high path), compared with 1995–2014. #ClimateAction`); });
  }
  } catch (err) { console.error(err); }
  // 5. sea level (coastal cities)
  try {
  G = SL && SL[e.s];
  if (G) {
    const [gname, dist, y0, y1, slope, vals] = G, pts = vals.map((v, i) => [y0 + i, v]), have = vals.filter(v => v != null), rise = have[have.length - 1] - have[0];
    const svg = fxLine('fx-s', {x0: y0, x1: y1, zero: false, series: [{name: 'Each year', color: '#9ecae1', pts, w: 1.2, op: .9}, {name: '11-year average', color: '#08519c', smooth: true, pts: fxMean(pts, 11), w: 2.8}], aria: `Sea level at the ${gname} tide gauge, ${y0} to ${y1}`, yfmt: v => (v >= 0 ? '+' : '−') + Math.abs(v), vfmt: v => (v >= 0 ? '+' : '−') + Math.round(Math.abs(v)) + ' mm', snap: 2, note: 'mm, compared with the 1990s average'});
    blocks.push(fxBlock('fx-s', 'Rising seas', `Yearly average sea level at the ${esc(gname)} tide gauge${dist ? ` (${dist} km from the city centre)` : ''}, compared with its 1990–1999 average.`, `<div class="emis-facts"><div><span>Rise since ${y0}</span><b>${rise >= 0 ? '+' : '−'}${Math.abs(rise)} mm</b></div>${slope != null ? `<div><span>Last 50 years</span><b>${slope >= 0 ? '+' : '−'}${Math.abs(slope).toFixed(1)} mm a year</b></div>` : ''}</div>${svg}`, `<b>Source:</b> <a href="https://psmsl.org" target="_blank" rel="noopener">Permanent Service for Mean Sea Level</a> (PSMSL), revised local reference annual data; the nearest long tide-gauge record within 60 km. This is sea level relative to the land the gauge sits on, so it also includes land that is sinking or rising locally. For comparison, global sea level has risen about 3.5 mm a year recently.`));
    wires.push(() => { fxLineWire('fx-s'); fxShare('fx-s', e, 'sea-level', 'Sea level: ' + P, `Sea level at the ${gname} tide gauge near ${P} has risen ${Math.abs(rise)} mm since ${y0}${slope != null ? ` (about ${slope.toFixed(1)} mm a year over the last 50 years)` : ''}. #ClimateAction`); });
  }
  } catch (err) { console.error(err); }
  // 6. disasters: damage as a share of GDP (countries only: it makes little sense at region or city scale)
  try {
  dv = e.t === 'country' && e.c !== 'EUU' && DS && DS.d.c[e.c];
  if (dv) {
    const D0 = DS.d.y0, usd = dv[0], pct = dv[1], valid = pct.filter(v => v != null), mxv = Math.max(...valid), wi = pct.indexOf(mxv), avg = valid.reduce((a, v) => a + v, 0) / valid.length;
    const money = m => m >= 1000 ? '$' + (m / 1000).toFixed(m >= 100000 ? 0 : 1) + ' billion' : '$' + (m >= 10 ? Math.round(m) : m.toFixed(1)) + ' million';
    const pf = v => (v < 10 ? v.toFixed(v < 1 ? 2 : 1) : Math.round(v)) + '%';
    const sc = fxNiceScale(0, mxv * 1.05), W = 900, Hh = 260, L = 72, R = 18, Tt = 14, B = 32, y = v => Tt + (1 - v / sc.b) * (Hh - Tt - B), bw = (W - L - R) / pct.length;
    const bars = pct.map((v, i) => v == null ? '' : `<rect x="${(L + i * bw + 2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${Math.max(0, y(0) - y(v)).toFixed(1)}" rx="2" fill="#7a4a9e"></rect>`).join('') + pct.map((v, i) => v == null ? '' : `<rect class="fxhit" x="${(L + i * bw).toFixed(1)}" y="${Tt}" width="${bw.toFixed(1)}" height="${Hh - Tt - B}" fill="transparent" data-tip="${esc(`<div class="tipms"><b>${D0 + i}</b><div class="mrow"><span class="my" style="color:#7a4a9e">${pf(v)}</span><span>of GDP</span></div><div class="mrow"><span class="my">${money(usd[i] || 0)}</span><span>estimated damage</span></div></div>`)}"/>`).join('');
    const ticks = [0, 6, 12, 18, 24].filter(i => i < pct.length).map(i => `<text x="${L + i * bw + bw / 2}" y="${Hh - 10}" text-anchor="middle" font-size="12" fill="#7a7385">${D0 + i}</text>`).join('');
    const grid = sc.t.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? '#9a94a3' : '#ece8ef'}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="#7a7385">${t}%</text>`).join('');
    const mid = ((Tt + Hh - B) / 2).toFixed(1);
    const svg = `<svg viewBox="0 0 ${W} ${Hh}" id="fx-d-svg" role="img" aria-label="Economic damage from natural disasters in ${esc(P)} as a share of GDP, ${D0} to ${DS.d.y1}" style="width:100%;height:auto;display:block">${grid}${bars}${ticks}<text transform="rotate(-90 14 ${mid})" x="14" y="${mid}" text-anchor="middle" font-size="12.5" fill="#7a7385">damage, % of GDP</text></svg>`;
    const worst = `${D0 + wi}: ${pf(mxv)} of GDP (about ${money(usd[wi] || 0)})`;
    const lede = `Estimated economic damage each year from floods, storms, droughts, extreme temperatures, wildfires and other natural disasters in ${esc(P)}, as a share of its GDP. Shown for countries only: damage figures are not reliable at smaller scales.`;
    const facts = `<div class="emis-facts"><div><span>Average, ${D0}–${DS.d.y1}</span><b>${pf(avg)} of GDP a year</b></div><div><span>Worst year</span><b>${worst}</b></div></div>`;
    const src = `<b>Source:</b> EM-DAT (CRED / UCLouvain) via <a href="https://ourworldindata.org/grapher/natural-disasters-economic-damages" target="_blank" rel="noopener">Our World in Data</a>: total economic damage each year divided by GDP. The dollar figures in the hover multiply that share by GDP in current US dollars from the <a href="https://data.worldbank.org/indicator/NY.GDP.MKTP.CD" target="_blank" rel="noopener">World Bank</a> and are not adjusted for inflation. EM-DAT does not have a damage estimate for every disaster, so years with none reported show as zero and the totals are likely to be underestimates. Not all disasters are caused by climate change (earthquakes, for example, are not).`;
    blocks.push(fxBlock('fx-d', 'Cost of natural disasters', lede, facts + svg, src));
    wires.push(() => { fxTipWire('fx-d-svg'); });
    wires.push(() => fxShare('fx-d', e, 'disaster-damage', 'Cost of natural disasters: ' + P, `Natural disasters have cost ${P} about ${pf(avg)} of its GDP a year on average since ${D0}, and ${pf(mxv)} in the worst year (${D0 + wi}) (EM-DAT). #ClimateAction`));
  }
  } catch (err) { console.error(err); }
  if (!blocks.length) { body.innerHTML = '<p class="muted">We could not show climate data for this place. If the page was open for a while, please refresh it.</p>'; return; }
  body.innerHTML = blocks.join(''); wires.forEach(w => { try { w(); } catch (x) {} });
  const sub = $('#fx-sub'); if (sub) sub.textContent = 'Warming so far, what the models project, very hot days, rainfall' + (G ? ', sea level' : '') + (dv ? ' and disasters' : '') + '.';
}
/* ---------- HOME: climate change so far (global indicators) ---------- */
async function globalFxShow(){
  const box = $('#gfx'); if (!box) return; const DS = await loadScr('disasters.js', 'NZD'); if (!DS || !$('#gfx')) { if (box) box.innerHTML = ''; return; }
  const gt = DS.gt, v = gt.v.map(x => x == null ? null : x / 100), seg = (a, b) => v.slice(a - gt.y0, b - gt.y0 + 1).filter(x => x != null), mean = xs => xs.reduce((p, c) => p + c, 0) / xs.length;
  const last = gt.y1, now10 = mean(seg(last - 9, last)), pre = mean(seg(1850, 1900)), warm = now10 - pre, base = mean(seg(1971, 2000)), hist = seg(1901, 2000), sd = Math.sqrt(mean(hist.map(x => (x - mean(hist)) ** 2))), rng = 2.6 * sd;
  const col = x => { if (x == null) return '#ebe8ef'; const z = (x - base) / rng, k = Math.min(7, Math.floor(Math.min(1, Math.abs(z)) * 8)); return z < 0 ? STR_BLUE[k] : STR_RED[k]; };
  const hotG = v.map((x, i) => [gt.y0 + i, x]).filter(p => p[1] != null).sort((a, b) => b[1] - a[1]).slice(0, 10).filter(p => p[0] >= 2015).length;
  const n = v.length, W = 420, bw = W / n, stripes = `<svg viewBox="0 0 ${W} 150" id="g-warm-svg" role="img" aria-label="Global warming stripes, ${gt.y0} to ${gt.y1}" style="width:100%;height:auto;display:block;border-radius:6px">${v.map((x, i) => `<rect x="${(i * bw).toFixed(2)}" y="0" width="${(bw + .5).toFixed(2)}" height="124" fill="${col(x)}"><title>${gt.y0 + i}: ${x == null ? 'no data' : (x - pre >= 0 ? '+' : '−') + Math.abs(x - pre).toFixed(2) + '°C vs 1850–1900'}</title></rect>`).join('')}<text x="2" y="144" font-size="12" fill="#7a7385">${gt.y0}</text><text x="${W - 2}" y="144" text-anchor="end" font-size="12" fill="#7a7385">${gt.y1}</text></svg>`;
  const c = DS.co2, cv = c.v.map((x, i) => [c.y0 + i, x]), ppm = c.v[c.v.length - 1], co2svg = fxLine('g-co2', {W: 420, H: 190, x0: c.y0, x1: c.y1, zero: false, series: [{name: 'CO₂ in the air', color: '#7a4a9e', pts: cv, w: 2.6}, {name: 'Before the industrial era (about 280)', color: '#9a94a3', pts: [[c.y0, 280], [c.y1, 280]], w: 1.6, dash: true}], aria: 'Carbon dioxide in the air in parts per million, 1959 to ' + c.y1, vfmt: x => Math.round(x) + ' ppm', yfmt: x => x, snap: 2});
  const ev = DS.ev, evY = Array.from({length: ev.clim.length}, (_, i) => ev.y0 + i), disSvg = fxLine('g-dis', {W: 420, H: 190, x0: ev.y0, x1: ev.y1, series: [{name: 'Weather- and climate-related disasters', color: '#c8331f', pts: evY.map((y, i) => [y, ev.clim[i]]), w: 2.6}], aria: 'Reported weather and climate disasters a year worldwide, ' + ev.y0 + ' to ' + ev.y1, vfmt: x => Math.round(x) + ' disasters', yfmt: x => x, snap: 2});
  const e70 = mean(ev.clim.slice(0, 10)), eNow = mean(ev.clim.slice(-5));
  const card = (id, title, big, sub, svg, key, src) => `<div class="card fxg"><div class="shead"><h3>${title}</h3>${shareBarHtml('sh-' + id)}</div><div class="fxbig">${big}</div><p class="muted" style="margin:2px 0 10px;font-size:14.5px">${sub}</p>${svg}${key || ''}<p class="muted emis-src" style="margin-top:10px">${src}</p></div>`;
  box.innerHTML = card('g-warm', 'The world is warming', `${warm >= 0 ? '+' : '−'}${Math.abs(warm).toFixed(1)}°C`, `The last ten years compared with 1850–1900, and ${hotG} of the 10 hottest years on record have come since 2015. Each stripe is one year.`, stripes, '', `<b>Source:</b> <a href="https://berkeleyearth.org/data/" target="_blank" rel="noopener">Berkeley Earth</a>, global land and ocean surface temperature (CC BY-NC 4.0). Colours: <a href="https://showyourstripes.info" target="_blank" rel="noopener">Ed Hawkins’ warming stripes</a>.`)
    + card('g-co2', 'More carbon dioxide in the air', `${Math.round(ppm)} ppm`, `About ${Math.round((ppm / 280 - 1) * 100)}% more than before the industrial era (about 280 ppm).`, co2svg, '', `<b>Source:</b> <a href="https://gml.noaa.gov/ccgg/trends/" target="_blank" rel="noopener">NOAA Global Monitoring Laboratory</a>, annual mean at Mauna Loa, Hawaii (public domain).`)
    + card('g-dis', 'More weather disasters reported', `${Math.round(eNow)} a year`, `Floods, storms, droughts, wildfires and heat extremes, up from about ${Math.round(e70)} a year in the 1970s.`, disSvg, '', `<b>Source:</b> EM-DAT (CRED / UCLouvain) via <a href="https://ourworldindata.org/grapher/natural-disasters-by-type" target="_blank" rel="noopener">Our World in Data</a> (CC BY). Part of the rise is better reporting over time, not only more disasters.`);
  fxLineWire('g-co2'); fxLineWire('g-dis');
  const gs = (id, name, title, text, svgId) => shareWire('sh-' + id, {url: () => location.href.split('#')[0], name, title: () => title, svg: () => $('#' + svgId), text: () => text});
  gs('g-warm', 'global-warming', 'The world is warming', `The world has warmed about ${warm.toFixed(1)}°C since 1850–1900 (average of the last 10 years), and ${hotG} of the 10 hottest years on record have come since 2015. #ClimateAction`, 'g-warm-svg');
  gs('g-co2', 'global-co2', 'Carbon dioxide in the air', `Carbon dioxide in the air has reached ${Math.round(ppm)} ppm, about ${Math.round((ppm / 280 - 1) * 100)}% more than before the industrial era. #ClimateAction`, 'g-co2-svg');
  gs('g-dis', 'global-disasters', 'Reported weather and climate disasters', `About ${Math.round(eNow)} weather- and climate-related disasters are now reported worldwide each year, up from about ${Math.round(e70)} in the 1970s (reporting has also improved). #ClimateAction`, 'g-dis-svg');
}
function effectsShow(e){
  if (e.t === 'company') return;
  $('#fx-title').textContent = `See the effects of climate change on ${fxPlace(e)}`;
  $('#str-sec').hidden = false;
  const dd = $('#fx-dd'); if (!dd) return;
  dd.addEventListener('toggle', () => { if (dd.open && !dd.dataset.r) { dd.dataset.r = '1'; fxRender(e); } });
}
function emisSeries(e){ const K = window.NZCE; if (e.t === 'company') { const k = K && K.d[e.s]; return k ? {y0:k.y0, v:k.v, kind:'k', k} : null; } const E = window.NZE; if (!E) return null; if (E.c[e.s]) return {y0:E.c[e.s][0], v:E.c[e.s][1], kind:'c'}; if (E.e[e.s]) return {y0:E.y0, v:E.e[e.s], kind:'e'}; return null; }
const M2 = {L:'location-based (local grid average)', M:'counts renewable-energy certificates', U:'may count renewable-energy certificates (not stated)'};
function m2Sum(K){ const c = new Set(K.m2.filter(Boolean)); return c.size === 1 ? {L:'location-based', M:'counts renewable-energy certificates', U:'may count renewable-energy certificates'}[[...c][0]] : 'method varies by year, see hover'; }
function compSrc(e, K, y0, y1){
  if (K.src === 'ct') return `Source: <a href="https://climatetrace.org" target="_blank" rel="noopener">Climate TRACE</a> (CC BY 4.0), ${y0}–${y1}. Independent estimates from satellite and other data for the sites owned by ${esc(K.nm)} and its majority-owned subsidiaries, in the industries Climate TRACE tracks (such as power, oil and gas, coal mining, steel, cement and aluminium). They count direct (Scope 1) emissions only, at the plants Climate TRACE tracks, so they are likely to be lower than the company's full total. They are not figures the company reported. Changes made: this prototype added up the sites using Climate TRACE's ownership data. <a href="#/notes/emissions">How this was built</a>.`;
  const ms = new Set(K.m2.filter(Boolean));
  const meth = ms.size === 1 && ms.has('L') ? 'Scope 2 is location-based (the average emissions of the local grid).' : ms.has('U') || ms.has('M') ? `${ms.has('U') ? 'The reports do not say whether Scope 2 counts renewable-energy certificates.' : 'Some years count renewable-energy certificates.'} Companies can buy these paper claims to report their electricity as clean while the grid they draw from is no cleaner. Like <a href="#/learn/offsets">offsets</a>, they can make emissions look lower than they are, so read drops in the lighter band with care. Hover a year to see what is known.` : 'Hover a year to see which Scope 2 method was used.';
  return `Source: worldwide greenhouse gas emissions reported by ${esc(e.n)} in its GRI and CDP disclosures, compiled by <a href="https://wikirate.org" target="_blank" rel="noopener">Wikirate</a> (CC BY 4.0)${K.doc ? ` (<a href="${esc(K.doc)}" target="_blank" rel="noopener">latest source document</a>)` : ''}. Scope 1 is direct emissions; Scope 2 is from the electricity, heat and steam the company buys. ${meth} Years with clear unit errors were left out, and gaps are years with no usable figure. <a href="#/notes/emissions">How this was built</a>.`;
}
const fmtMt = v => v >= 100 ? fmt(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
function emisChart(e){
  const pc = EPC.on && e.t !== 'company' && hasPop(e), se = viewSeries(e, pc); if (!se) return '';
  const {y0, v, kind} = se, y1 = y0 + v.length - 1, nz = isNZ(e) ? year(e) : null, iy = iyear(e), ib = parseInt(e.ib), ip = +e.ip;
  const val = yr => v[yr - y0];
  const endX = pc ? y1 + 2 : Math.min(2100, Math.max(2050, nz || 0, y1 + 5)), W = chartW(), H = W < 600 ? 300 : 330, L = 64, R = 24, T = 46, B = 36;
  const nzOk = !pc && nz && nz > y1 && nz <= 2100, endY = pc ? endX : Math.max(endX, nzOk ? nz : 0);
  const ymax = Math.max(...v) * 1.1, x = yr => L + (yr - y0) / (endY - y0) * (W - L - R), yy = m => T + (1 - m / ymax) * (H - T - B);
  const step = (endY - y0) > 120 ? 25 : (endY - y0) > 60 ? 10 : 5, ticks = []; for (let t = Math.ceil(y0 / step) * step; t <= endY; t += step) ticks.push(t);
  const nice = ymax / 4, mag = 10 ** Math.floor(Math.log10(nice)), ny = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= nice), yt = []; for (let t = 0; t <= ymax; t += ny) yt.push(t);
  const PT = v.map((m, i) => [y0 + i, m]).filter(p => p[1] != null);  // company series can skip years
  const line = PT.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${yy(p[1]).toFixed(1)}`).join('');
  const K = kind === 'k' ? se.k : null;
  const s1p = K && K.s1 ? K.s1.map((m, i) => [y0 + i, m]).filter(p => p[1] != null && v[p[0] - y0] != null) : [];
  const s1path = s1p.length > 1 ? `<path d="${s1p.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${yy(p[1]).toFixed(1)}`).join('')}L${x(s1p[s1p.length - 1][0])} ${yy(0)}L${x(s1p[0][0])} ${yy(0)}Z" fill="#A5865C" opacity=".8"/>` : '';
  const dots = K ? PT.map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${yy(p[1]).toFixed(1)}" r="3.4" fill="#A5865C"/>`).join('') : '';
  const last = v[v.length - 1], lx = x(y1), ly = yy(last);
  const base = ib >= y0 && ib <= y1 ? val(ib) : null, ims = !pc && base && iy && ip > 0 && iy > y1 && iy <= 2100 ? [iy, base * (1 - ip / 100)] : null;
  const rec = e.ghg && e.iy_inv && +e.iy_inv >= y0 && +e.iy_inv <= y1 ? [+e.iy_inv, e.ghg / 1e6] : null;
  const path = [];
  if (nzOk) { const from = ims || [y1, last]; if (ims) path.push(`<line x1="${lx}" y1="${ly}" x2="${x(ims[0])}" y2="${yy(ims[1])}" stroke="#3B7CC3" stroke-width="2.5" stroke-dasharray="6 5"/>`); path.push(`<line x1="${x(from[0])}" y1="${yy(from[1])}" x2="${x(nz)}" y2="${yy(0)}" stroke="#3B7CC3" stroke-width="2.5" stroke-dasharray="6 5"/><path d="M${x(nz)} ${yy(0) - 9} l9 9 l-9 9 l-9 -9z" fill="#3B7CC3" stroke="#fff" stroke-width="2"><title>Net zero ${nz}</title></path><text x="${x(nz) - 14}" y="${yy(0) - 18}" text-anchor="end" font-size="12.5" font-weight="700" fill="#3B7CC3" paint-order="stroke" stroke="#fff" stroke-width="4">Net zero ${nz}</text>`); }
  else if (ims) path.push(`<line x1="${lx}" y1="${ly}" x2="${x(ims[0])}" y2="${yy(ims[1])}" stroke="#c27a00" stroke-width="2.5" stroke-dasharray="6 5"/>`);
  if (ims) path.push(`<circle cx="${x(ims[0])}" cy="${yy(ims[1])}" r="7" fill="#c27a00" stroke="#fff" stroke-width="2"><title>${ip}% below ${ib} by ${ims[0]}</title></circle><text x="${x(ims[0]) - 12}" y="${yy(ims[1]) - 12}" text-anchor="end" font-size="12" font-weight="600" fill="#7a4a00" paint-order="stroke" stroke="#fff" stroke-width="4">${ims[0]}: ${ip}% below ${ib}</text>`);
  const svg = `<svg viewBox="0 0 ${W} ${H}" id="emis-svg" data-end="${endY}" data-t="${T}" data-h="${H}" data-b="${B}" data-ymax="${ymax}" role="img" aria-label="Greenhouse gas emissions of ${esc(e.n)} from ${y0} to ${y1}, latest ${fmtMt(last)} million tonnes CO2 equivalent" style="width:100%;height:auto;display:block">
    ${yt.map(t => `<line x1="${L}" x2="${W - R}" y1="${yy(t)}" y2="${yy(t)}" stroke="#ece8ef"/><text x="${L - 8}" y="${yy(t) + 4}" text-anchor="end" font-size="12" fill="#7a7385">${fmt(t)}</text>`).join('')}
    ${ticks.map(t => `<text x="${x(t)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="#7a7385">${t}</text><line x1="${x(t)}" x2="${x(t)}" y1="${H - B}" y2="${H - B + 4}" stroke="#bbb"/>`).join('')}
    <text x="14" y="13" font-size="12" fill="#7a7385">${pc ? 't CO₂e per person a year' : 'Mt CO₂e per year'}</text>
    <path d="${line}L${lx} ${yy(0)}L${x(PT[0][0])} ${yy(0)}Z" fill="#e6d6bd" opacity=".75"/>${s1path}<path d="${line}" fill="none" stroke="#A5865C" stroke-width="2.6" stroke-linejoin="round"/>${dots}
    <line x1="${x(y1)}" x2="${x(y1)}" y1="${T}" y2="${H - B}" stroke="#bdb6c6" stroke-dasharray="3 4"/>
    ${pmarks(x, y0, endY, T, H - B, 'lines')}
    ${path.join('')}
    <circle cx="${lx}" cy="${ly}" r="5" fill="#A5865C" stroke="#fff" stroke-width="2"/>
    <text x="${lx - 10}" y="${ly - 26 > T + 30 ? ly - 26 : ly + 34}" text-anchor="end" font-size="12.5" font-weight="700" fill="#5b4a2e" paint-order="stroke" stroke="#fff" stroke-width="4">${fmtMt(last)} ${pc ? 't per person' : 'Mt'} in ${y1}</text>
    <line id="emis-x" y1="${T}" y2="${H - B}" stroke="#271039" stroke-width="1" opacity="0"/><circle id="emis-d" r="5" fill="#271039" stroke="#fff" stroke-width="2" opacity="0"/>
    <rect id="emis-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>${pmarks(x, y0, endY, T, H - B, 'labels')}</svg>`;
  let pk = 0; v.forEach((m, i) => { if (m > v[pk]) pk = i; });
  const U = pc ? 't CO₂e per person' : 'Mt CO₂e', facts = [[`Latest (${y1})`, `${fmtMt(last)} ${U}`], [`Peak (${y0 + pk})`, `${fmtMt(v[pk])} ${U}`]];
  if (y0 <= 1990 && y1 > 1990 && val(1990)) { const c = (last / val(1990) - 1) * 100; facts.push(['Change since 1990', `${c > 0 ? '+' : '−'}${Math.abs(c).toFixed(0)}%`]); }
  if (K) facts.push(['Years with figures', `${PT.length} of ${y1 - y0 + 1} (${y0}–${y1})`]);
  if (kind === 'c' && !pc) facts.push([`Since ${y0}`, `${fmt(Math.round(v.reduce((a, b) => a + b, 0) / 1000))} Gt CO₂e in total`]);
  const src = K ? compSrc(e, K, y0, y1) : kind === 'c'
    ? `Source: <a href="https://ourworldindata.org/co2-and-greenhouse-gas-emissions" target="_blank" rel="noopener">Our World in Data</a> (total greenhouse gases including land use and forestry, from Jones et al., 2024; CC BY). Estimates before about 1950 are rough.`
    : (() => { const u = (window.NZE.u || {})[e.s], R = (window.NZE.r || {})[e.s] || 10;
      const where = e.t !== 'city' ? 'summed over the grid cells inside the ' + (e.t === 'region' ? regTerm(e)[0] : 'region') : u ? (u[2] ? `summed over the part of the urban centre “${esc(u[0])}” (${fmt(u[1])} km²) within about ${Math.max(R, 10)} km of the city centre, because that urban centre contains several cities in the Tracker` : `summed over the urban centre outline for ${esc(u[0])} (${fmt(u[1])} km²) from the European Commission’s <a href="https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php" target="_blank" rel="noopener">Global Human Settlement Layer</a>`) : `summed over the grid cells within about ${R} km of the city centre, because no urban outline matched`;
      return `Source: <a href="https://edgar.jrc.ec.europa.eu/dataset_ghg80" target="_blank" rel="noopener">EDGAR v8.0</a>, European Commission Joint Research Centre (CC BY 4.0): all greenhouse gases from human activity except land use, as CO₂ equivalent, ${where}. The data is gridded at roughly 11 km, so it is approximate and will not match an official inventory. <a href="#/notes/emissions">How this was built</a>.`; })();
  const pcNote = pc ? (e.t === 'country' ? ' Per person: divided by each year\'s population (Our World in Data, CC BY).' : ` Per person: divided by today\'s population (${fmt(+e.pop)}), because yearly population figures are not available here, so earlier years are only indicative.`) + ' Target paths are shown only for totals, because targets are set for total emissions.' : '';
  return `${e.t !== 'company' && hasPop(e) ? `<div class="emis-ctl"><div class="seg segs" role="group" aria-label="Measure"><button data-pc="0" class="${pc ? '' : 'on'}"><b>Total</b></button><button data-pc="1" class="${pc ? 'on' : ''}"><b>Per person</b></button></div></div>` : ''}<div class="card emis"><div class="emis-facts">${facts.map(([k, vv]) => `<div><span>${k}</span><b>${vv}</b></div>`).join('')}</div>${svg}
    <div class="emis-key">${K && K.src === 'wr' ? `<span><i style="background:#A5865C;opacity:.8"></i>Scope 1: direct</span><span><i style="background:#e6d6bd"></i>Scope 2: purchased energy (${m2Sum(K)})</span>` : `<span><i style="background:#A5865C"></i>Emissions</span>`}${nzOk || ims ? `<span><i class="dash"></i>Straight-line path to the target${ims ? ' milestone' : ''}${nzOk ? ' and net zero' : ''} (illustrative)</span>` : ''}</div>
    <p class="muted emis-src">${src}${pcNote}</p></div>`;
}
function emisWire(e){
  const se = viewSeries(e, EPC.on && e.t !== 'company' && hasPop(e)), svg = $('#emis-svg'); if (!se || !svg) return;
  treatyWire(svg, [e]);
  const hit = $('#emis-hit'), vx = $('#emis-x'), vd = $('#emis-d'), {y0, v} = se, y1 = y0 + v.length - 1;
  const bb = () => { const r = svg.viewBox.baseVal; return r; };
  hit.addEventListener('mousemove', ev => {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const hx = +hit.getAttribute('x'), hw = +hit.getAttribute('width'), t = Math.max(0, Math.min(1, (p.x - hx) / hw));
    const yrs = svg.querySelector('text[font-size="12"][text-anchor="middle"]'); void yrs;
    const endAttr = +svg.dataset.end; const yr = Math.round(y0 + t * ((endAttr || y1) - y0)); if (yr > y1 || yr < y0) { hideTip(); vx.setAttribute('opacity', 0); vd.setAttribute('opacity', 0); return; }
    const X = hx + (yr - y0) / ((endAttr || y1) - y0) * hw, K = se.k, i = yr - y0;
    if (v[i] == null) { vx.setAttribute('x1', X); vx.setAttribute('x2', X); vx.setAttribute('opacity', .2); vd.setAttribute('opacity', 0); showTip(`<div class="tipms"><b>${yr}</b><div class="mrow"><span>No figure for this year</span></div></div>`, ev); return; }
    const Y = +svg.dataset.t + (1 - v[yr - y0] / +svg.dataset.ymax) * (+svg.dataset.h - +svg.dataset.t - +svg.dataset.b);
    vx.setAttribute('x1', X); vx.setAttribute('x2', X); vx.setAttribute('opacity', .35); vd.setAttribute('cx', X); vd.setAttribute('cy', Y); vd.setAttribute('opacity', 1);
    const split = K && K.s1 ? `<div class="mrow"><span class="my">${fmtMt(K.s1[i])}</span><span>Scope 1 (direct)</span></div>` + (K.s2[i] != null ? `<div class="mrow"><span class="my">${fmtMt(K.s2[i])}</span><span>Scope 2, ${M2[K.m2[i]] || 'method not stated'}</span></div>` : `<div class="mrow"><span>Scope 2 not reported</span></div>`) : '';
    showTip(`<div class="tipms"><b>${yr}</b><div class="mrow"><span class="my">${fmtMt(v[yr - y0])}</span><span>${se.pc ? 't CO₂e per person' : 'Mt CO₂e'}${split ? ' in total' : ''}</span></div>${split}</div>`, ev);
  });
  hit.addEventListener('mouseleave', () => { hideTip(); vx.setAttribute('opacity', 0); vd.setAttribute('opacity', 0); });
}
const CITY_MIN = 500000;
const NAF = ['Egypt','Morocco','Algeria','Tunisia','Libya'];
const CAS = ['Kazakhstan','Uzbekistan','Turkmenistan','Kyrgyzstan','Tajikistan','Afghanistan','Azerbaijan','Georgia','Armenia'];
function grp(e){
  const g = e.g, n = e.cn || e.n;
  if (e.t === 'country') {  // too few countries for the city groupings, so China and the Americas are folded in
    if (n === 'China' || g === 'East Asia' || g === 'Oceania') return 'East Asia and the Pacific';
    if (g === 'North America' || g === 'Latin America and the Caribbean') return 'the Americas';
  }
  if (n === 'Mexico') return 'Latin America and the Caribbean';
  if (g === 'North America') return 'the United States and Canada';
  if (n === 'China') return 'China';
  if (g === 'East Asia' || g === 'Oceania') return 'East Asia and the Pacific (excluding China)';
  if (g === 'South Asia' || CAS.includes(n)) return 'South and Central Asia';
  if (g === 'Western and Central Asia' || NAF.includes(n)) return 'the Middle East and North Africa';
  if (g === 'Africa') return 'Sub-Saharan Africa';
  return g || 'the rest of the world';
}
const PM = {};  // chosen comparison mode per entry type, kept while browsing
function peerModes(e){
  if (e.t === 'company') return [['sector','Same sector'],['world','All companies'],['size','Similar revenue']];
  if (e.t === 'country') return [['region','Region'],['world','World'],['size','Similar population'],['gdp','Similar GDP']];
  return [['region','Region'],['country','Same country'],['world','World'],['size','Similar size'],['gdp','Similar GDP']];
}
function peerMode(e){
  const ms = peerModes(e).map(m => m[0]);
  const want = PM[e.t] && ms.includes(PM[e.t]) ? PM[e.t] : ms[0];
  return want;
}
const shortName = e => (e.n.match(/\(([^)]+)\)/) || [, e.n])[1];
function peers(e, mode){
  if (e.t === 'city' && !(e.pop >= CITY_MIN)) return {label:'', xs:[], small:true, mode:''};
  mode = mode || peerMode(e);
  const T = TYPE[e.t][1].toLowerCase(), key = e.t === 'company' ? 'rev' : 'pop';
  // cities: the Tracker's coverage rule is 500,000+ people, so smaller cities never count as peers
  const pool = e.t === 'city' ? byType('city').filter(x => x.pop >= CITY_MIN) : byType(e.t);
  const tail = e.t === 'city' ? ' with over 500,000 population' : '';
  let xs, label;
  if (mode === 'sector') { const ok = e.sec && e.sec !== 'NA'; xs = pool.filter(x => ok ? x.sec === e.sec : true); label = ok ? `${e.sec} companies` : 'companies'; }
  else if (mode === 'world') { xs = pool; label = e.t === 'company' ? 'companies in the Tracker' : `${T} in the world${tail}`; }
  else if (mode === 'country') { xs = pool.filter(x => x.c === e.c); label = `${T} in ${e.cn}${tail}`; }
  else if (mode === 'size' || mode === 'gdp') {
    const k2 = mode === 'gdp' ? 'gdp' : key, v = e[k2] || 0, N = 25;
    xs = pool.filter(x => x[k2] > 0).sort((a, b) => Math.abs(Math.log(a[k2] / v)) - Math.abs(Math.log(b[k2] / v))).slice(0, N);
    const lo = Math.min(...xs.map(x => x[k2])), hi = Math.max(...xs.map(x => x[k2]));
    const rng = k2 === 'gdp' ? `${money(lo)} to ${money(hi)} GDP` : k2 === 'rev' ? `${money(lo)} to ${money(hi)} in annual revenue` : `${people(lo)} to ${people(hi)} people`;
    label = `${T} closest in ${k2 === 'gdp' ? 'GDP' : k2 === 'rev' ? 'revenue' : e.t === 'city' ? 'size' : 'population'} (${rng})`;
  }
  else { const G = grp(e); xs = pool.filter(x => grp(x) === G); label = `${T} in ${G}${tail}`; }
  return {label, xs, mode};
}
function peerBasis(e){
  if (e.t === 'city') return '';
  if (e.t === 'company') return 'The Tracker covers the Forbes Global 2000 (the largest public companies by sales) plus the 100 largest private companies.';
  if (e.t === 'country') return 'The Tracker covers every country that is a member of the UN climate convention.';
  return 'The Tracker covers all regions in the 25 highest-emitting countries.';
}
function asks(e){
  const cs = checks(e), out = [], n = nm(e), gv = e.t !== 'company';
  if (!isNZ(e)) {
    out.push([`Will ${n} commit to reaching net zero, and by what year?`, 'Most of its peers already have. Ask for a date and a legal or board-level commitment.']);
    out.push([`What will ${n} cut by 2030?`, 'A near-term number matters more than a distant date.']);
    out.push([gv ? 'Who in government is responsible for climate targets, and when will a plan be published?' : 'Which board member is accountable for climate strategy?', 'Find the person who can actually say yes.']);
    return out;
  }
  const q = {
    lock: gv ? [`Will ${n} put its net zero target into law?`, 'Targets in law outlast elections and can be enforced in court.'] : [`Will the board formally adopt the target and tie executive pay to it?`, 'A strategy-level commitment is harder to drop quietly.'],
    interim: [`What will ${n} have cut by 2030 and 2035, compared with which base year?`, 'Ask for a specific percentage and base year.'],
    gas: [`Why does the target leave out methane and other non-CO₂ gases?`, 'Methane is a large, fast-acting share of warming.'],
    s3: [`Will the target cover emissions from suppliers and from customers using your products (Scope 3)?`, 'For most companies these are the majority of emissions.'],
    cons: [`Will ${n} report the emissions caused by the goods it imports?`, 'Otherwise emissions can be pushed overseas instead of cut.'],
    plan: [`Where is the plan showing which measures deliver which cuts, and by when?`, 'We look for measures, expected cuts, scale and a review schedule.'],
    rep: [`Will ${n} publish progress every year?`, 'Annual reporting lets the public check the trend.'],
    acc: [`Who is formally responsible if the target is missed?`, 'For example an independent climate council or a named minister.'],
    offsets: [`How much of the target depends on carbon offsets, and what quality rules apply?`, 'Ask for a maximum share and independent verification.'],
    rem: [`Will ${n} set separate targets for cutting emissions and for removing carbon?`, 'This keeps future removals from replacing cuts today.'],
  };
  cs.filter(c => c.v === 'no' || c.v === 'part').forEach(c => q[c.id] && out.push(q[c.id]));
  cs.filter(c => c.v === 'unk').slice(0, 2).forEach(c => q[c.id] && out.push([q[c.id][0], 'Public information was not clear on this point, so asking is worthwhile.']));
  if (!out.length) out.push([`Is ${n} on track for its milestone, and what does independent review say?`, 'This target meets all of our checks. The next question is delivery.']);
  return out;
}
function briefing(e){
  const cs = checks(e), t = tally(cs), pr = peers(e), nz = pct(pr.xs.filter(isNZ).length, pr.xs.length);
  const L = level(e);
  let b = `${Nm(e)}: ${targetPhrase(e)}${isNZ(e) ? ` (${L.label.toLowerCase()})` : ''}.`;
  if (e.it && e.it !== 'No target') b += ` Interim target: ${e.ip ? e.ip + '% cut' : e.it.toLowerCase()}${iyear(e) ? ' by ' + iyear(e) : ''}${e.ib ? ' vs ' + e.ib : ''}.`;
  if (isNZ(e)) b += ` Meets ${t.yes} of ${cs.length} Net Zero Tracker credibility checks${t.part ? `, partly meets ${t.part}` : ''}${t.unk ? `, ${t.unk} unclear` : ''}.`;
  const gaps = cs.filter(c => c.v === 'no').map(c => shortGap[c.id]);
  if (gaps.length && isNZ(e)) b += ` Gaps: ${gaps.join('; ')}.`;
  if (!pr.small) b += ` For comparison, ${nz}% of ${pr.label} have a net zero target.`;
  b += `\nSource: Net Zero Tracker, ${official(e)} (entry updated ${e.upd || 'n/a'}).`;
  return b;
}
/* ---------- LOCATOR MAP in the profile header: the world for countries, the country for regions and cities; every area is clickable ---------- */
const EU27N = ['040','056','100','191','196','203','208','233','246','250','276','300','348','372','380','428','440','442','470','528','616','620','642','703','705','724','752'];
async function loadGeo(){ if (!(window.d3 && window.topojson)) throw new Error('no map library'); if (!WORLD || !REG) [WORLD, REG] = await Promise.all([WORLD || fetch('world.json').then(r => r.json()), REG || fetch('regions.json').then(r => r.json())]); }
function mainPart(f){ if (f.geometry.type !== 'MultiPolygon') return f; let best = null, ba = -1; f.geometry.coordinates.forEach(c => { const a = d3.geoArea({type:'Polygon', coordinates:c}); if (a < 2 * Math.PI && a > ba) { ba = a; best = c; } }); return best ? {type:'Feature', properties:{}, geometry:{type:'Polygon', coordinates:best}} : f; }
async function localeMapShow(e){
  const box = $('#lmap'); if (!box || e.t === 'company') return;
  try { await loadGeo(); } catch (x) { return; }
  if (location.hash.indexOf('/e/' + e.s) < 0) return;
  const W = 300, H = 180, byIso = {}; D.forEach(x => { if (x.t === 'country' && x.iso) byIso[x.iso] = x; });
  const cEntry = e.t === 'country' ? e : D.find(x => x.t === 'country' && x.c === e.c), all = topojson.feature(WORLD, WORLD.objects.countries).features.filter(f => f.id !== '010');
  const mineIds = e.c === 'EUU' ? EU27N : (cEntry && cEntry.iso ? [cEntry.iso] : []), mine = all.filter(f => mineIds.includes(f.id));
  if (!mine.length) return;
  const mk = (d, cls, slug, label) => `<path d="${d}" class="${cls}"${slug ? ` data-s="${slug}" tabindex="0" role="link"` : ''} aria-label="${esc(label || '')}"/>`;
  const dotAt = (proj, x, cls) => { if (!x.ll) return ''; const p = proj([x.ll[1], x.ll[0]]); return p ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.2" class="${cls}" data-s="${x.s}" tabindex="0" role="link" aria-label="${esc(x.n)}"/>` : ''; };
  const countryProj = () => cEntry.c === 'USA' ? d3.geoAlbersUsa().fitExtent([[6, 6], [W - 6, H - 6]], {type:'FeatureCollection', features: mine}) : d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], {type:'FeatureCollection', features: mine.map(mainPart)});
  const regs = e.c === 'EUU' ? [] : topojson.feature(REG, REG.objects.regions).features.filter(f => BY[f.properties.s] && BY[f.properties.s].c === e.c).map(fixWinding);
  const cities = e.c === 'EUU' ? [] : D.filter(x => x.t === 'city' && x.c === e.c && x.ll);
  const figs = [];
  const fig = (svg, cap) => figs.push(`<figure class="lmapfig"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(cap)}">${svg}</svg><figcaption>${esc(cap)}</figcaption></figure>`);
  if (e.t === 'country') {
    const proj = d3.geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], {type:'Sphere'}), P = d3.geoPath(proj);
    fig(`<path d="${P({type:'Sphere'})}" class="lm-sea"/>` + all.map(f => { const x = byIso[f.id], me = mineIds.includes(f.id); return mk(P(f), me ? 'lm-me' : 'lm-c', x ? x.s : '', x ? x.n : ''); }).join(''), 'Location in the world');
    if (e.c !== 'EUU' && (regs.length || cities.length)) {
      const pj = countryProj(), P2 = d3.geoPath(pj);
      fig(mine.map(f => mk(P2(f), 'lm-c lm-base', '', '')).join('') + (regs.length ? regs.map(f => { const r = BY[f.properties.s]; return mk(P2(f), 'lm-r', r.s, r.n); }).join('') : cities.map(c => dotAt(pj, c, 'lm-dot2')).join('')), regs.length ? capW(regTerm(regs.map(f => BY[f.properties.s])[0] || e)[1]) + ' of ' + nm(e) : 'Cities in ' + nm(e));
    }
  } else {
    const pj = countryProj(), P = d3.geoPath(pj);
    fig(mine.map(f => mk(P(f), 'lm-c lm-base', cEntry.s, cEntry.n)).join('') + regs.map(f => { const r = BY[f.properties.s]; return mk(P(f), r.s === e.s ? 'lm-me' : 'lm-r', r.s, r.n); }).join('') + (e.t === 'city' ? dotAt(pj, e, 'lm-dot') .replace('r="4.2"', 'r="5"') + '' : ''), (e.t === 'region' ? placeName(e) + ' in ' : e.n + ' in ') + nm(cEntry));
    if (e.t === 'region') {
      const rf = regs.find(f => f.properties.s === e.s);
      // a city belongs to the region that contains it; if the (simplified) outlines leave it in no region at all, give it to the nearest one within about 35 km
      const near = (f, p) => { let best = Infinity; const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat(); rings.forEach(r => r.forEach(q => { const d = Math.hypot((q[0] - p[0]) * Math.cos(p[1] * Math.PI / 180), q[1] - p[1]); if (d < best) best = d; })); return best; };
      const CITY_REGION = {'new-york-cit-0101': 'new-york-state-reg-0015'};   // the simplified outlines put Manhattan inside New Jersey
      const inside = rf ? cities.filter(c => { if (CITY_REGION[c.s]) return CITY_REGION[c.s] === e.s; const p = [c.ll[1], c.ll[0]]; return d3.geoContains(rf, p) || (!regs.some(f => d3.geoContains(f, p)) && near(rf, p) < 0.35); }) : [];
      if (rf && inside.length) { const pj2 = d3.geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], rf), P2 = d3.geoPath(pj2); fig(mk(P2(rf), 'lm-me lm-self', '', e.n) + inside.map(c => dotAt(pj2, c, 'lm-dot2')).join(''), (inside.length === 1 ? 'The city in ' : 'Cities in ') + e.n); }
    }
  }
  box.innerHTML = figs.join('') + `<div class="lm-cap">Click an area or a dot to open its profile</div>`;
  const go = el => { const sl = el && el.dataset && el.dataset.s; if (sl && sl !== e.s) location.hash = '#/e/' + sl; };
  box.addEventListener('click', ev => go(ev.target.closest('[data-s]')));
  box.addEventListener('keydown', ev => { if (ev.key === 'Enter') go(ev.target.closest('[data-s]')); });
  const tip = ev => { const p = ev.target.closest('[data-s]'); if (!p) { hideTip(); return; } const x = BY[p.dataset.s]; if (!x) return; showTip(`<div class="tipms"><b>${esc(x.n)}</b><div class="mrow"><span class="my"></span><span>${esc(targetPhrase(x))}</span></div>${x.s === e.s ? '' : '<div class="mrow"><span class="my"></span><span style="color:#7a7385">Click to open</span></div>'}</div>`, ev); };
  box.addEventListener('mousemove', tip); box.addEventListener('mouseleave', hideTip);
}
P.entity = (params, slug) => {
  const e = BY[slug]; if (!e) return `<section><div class="wrap empty"><h1>Not found</h1><p>We couldn't find that entry. <a href="#/explore">Browse all entries</a>.</p></div></section>`;
  const L = level(e), cs = checks(e), t = tally(cs), n = cs.length, y = year(e);
  const pr = peers(e), px = pr.xs;
  const peerRows = [
    ['Has a net zero target', x => isNZ(x), isNZ(e)],
    ...cs.map(c => [c.q.replace(/\?$/, ''), x => isNZ(x) && checks(x).find(k => k.id === c.id)?.v === 'yes', c.v === 'yes']),
  ];
  const facts = [];
  if (e.t === 'company') { if (e.sec && e.sec !== 'NA') facts.push(['Sector', e.sec]); if (e.rev) facts.push(['Annual revenue', money(e.rev)]); facts.push(['Listed', e.priv === 'Yes' ? 'Private company' : 'Publicly traded']); }
  if (e.pop) facts.push(['Population', people(e.pop)]);
  if (e.gdp && e.t === 'country') facts.push(['GDP (PPP)', money(e.gdp)]);
  if (e.ghg) facts.push(['Emissions', (e.ghg >= 1e6 ? (e.ghg/1e6).toFixed(e.ghg >= 1e8 ? 0 : 1) + ' MtCO₂e' : fmt(Math.round(e.ghg)) + ' tCO₂e') + (e.iy_inv ? ` (${e.iy_inv})` : '')]);
  if (e.r2z === 'Yes') facts.push(['Race to Zero', 'Member']);
  const C = 2 * Math.PI * 40, segs = [['yes','#2f8a4c'],['part','#c27a00'],['no','#c8331f'],['unk','#c9c4cf']]; let off = 0;
  const ring = `<svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true" style="transform:rotate(-90deg)"><circle cx="48" cy="48" r="40" fill="none" stroke="#eee" stroke-width="10"/>${segs.map(([k,c]) => { const len = C * t[k] / n; const s = `<circle cx="48" cy="48" r="40" fill="none" stroke="${c}" stroke-width="10" stroke-dasharray="${Math.max(len-2,0)} ${C}" stroke-dashoffset="${-off}"/>`; off += len; return t[k] ? s : ''; }).join('')}</svg>`;
  const inCmp = compareSet.get().includes(e.s);
  return `
  <div class="phead"><div class="wrap">
    <div class="crumbs"><a href="#/">Home</a> › <a href="#/explore?type=${e.t}">${typePlural(e)}</a>${e.t!=='country' && e.cn ? ` › ${(() => { const c = D.find(x => x.t==='country' && x.c===e.c); return c ? `<a href="#/e/${c.s}">${esc(e.cn)}</a>` : esc(e.cn); })()}` : ''}</div>
    <div class="pgrid"><div class="pleft">${typeBadge(e.t, e)}
      <h1>${e.t==='country' ? `<span class="flag">${flag(e.a2)}</span>` : ''}${esc(e.on || e.n)}</h1>
      <div class="facts">${facts.map(([k,v]) => `<span>${k}: <b>${esc(v)}</b></span>`).join('')}</div>
      <div class="yr yr-inline"><div class="n">${isNZ(e) && y ? y : hasAnyTarget(e) && y ? y : '—'}</div><small>${isNZ(e) ? 'Net zero target year' : hasAnyTarget(e) ? 'Target year (not net zero)' : 'No target year'}</small></div></div>
      <div class="pmaps" id="lmap"></div>
    </div>
  </div></div>

  <section class="tight"><div class="wrap">
    <p class="eyebrow">The short version</p>
    <p class="summary">${summaryText(e)}</p>
    ${isNZ(e) ? `<div class="verdict"><div class="ring">${ring}<div class="t"><span>${t.yes}/${n}<small>checks met</small></span></div></div>
      <div class="tally"><span>${ICON.yes} ${t.yes} yes</span><span>${ICON.part} ${t.part} partly</span><span>${ICON.no} ${t.no} no</span><span>${ICON.unk} ${t.unk} unknown</span></div></div>` : ''}
    <div class="actions">
      <button class="btn btn-purple btn-sm" id="b-cmp">${inCmp ? '✓ In comparison' : '+ Add to compare'}</button>
      <button class="btn btn-ghost btn-sm" id="b-share">Share</button>
      <button class="btn btn-ghost btn-sm" id="b-link">Copy link</button>
      <a class="btn btn-ghost btn-sm" href="${official(e)}" target="_blank" rel="noopener">View on zerotracker.net ↗</a>
    </div>
  </div></section>

  <section class="tight band"><div class="wrap">
    <h2 class="h-brand" style="font-size:24px">Timeline</h2>
    <div class="timeline">${timelineSVG(e)}</div>
    <h3 class="mt2" style="font-size:19px">How firm is the commitment?</h3>
    <div class="ladder">${LADDER.map(l => `<div class="${Math.floor(L.k)===l.k ? 'on' : ''}${l.k >= 4 ? ' dk' : ''}" style="background:${l.hex}"><b>${l.label}</b>${l.plain}</div>`).join('')}<div class="${L.k<=0 ? 'on' : ''}" style="background:${L.k<0 ? OTHER.hex : NONE.hex}"><b>${L.k<0 ? 'Other target' : 'No net zero target'}</b>${L.k<0 ? 'Not net zero' : 'Nothing found'}</div></div>
    <div style="height:26px"></div>
  </div></section>
  <section class="tight" id="emis-sec" hidden><div class="wrap">
    <h2 class="h-brand" style="font-size:24px">Emissions history</h2>
    <p class="muted mt0" id="emis-lede"></p>
    <div id="emis"></div>
  </div></section>

  <section class="tight"><div class="wrap">
    <div class="flex" style="justify-content:space-between"><h2 class="h-brand" style="font-size:24px">Credibility checklist</h2><a href="#/learn/method" style="font-size:15px">Why these questions?</a></div>
    ${!isNZ(e) ? `<div class="note mt1">There is no net zero target, so these checks describe ${hasAnyTarget(e) ? 'its other climate target' : 'what any future target should include'}.</div>` : ''}
    <div class="checks mt2">${PILLARS.map(p => `<div class="card" style="--p:${p.col}"><h3><i></i>${p.name}</h3>${cs.filter(c => c.p === p.id).map(c => `<div class="item">${vtag(c.v)}<div><div class="q">${c.q}</div><div class="a">${esc(c.a)}</div><details><summary>Why it matters</summary>${esc(c.why)}</details></div></div>`).join('')}</div>`).join('')}</div>
  </div></section>

  <section class="tight band"><div class="wrap">
    <h2 class="h-brand" style="font-size:24px">How it compares</h2>
    ${pr.small ? `<p class="muted mt0">${esc(e.n)} has about ${fmt(e.pop)} people. The Tracker's city coverage starts at 500,000, so there is no peer group for it. Choose a city to compare it with.</p>
    <div class="light mt1" style="max-width:520px">${searchBox('s-peer', 'Search for a city to compare with…')}</div><p id="peer-msg" class="muted" style="font-size:14px" hidden>Please pick a city from the list.</p>` : `    <div class="seg peerseg" id="peerseg" role="group" aria-label="Compare with">${peerModes(e).map(([m, l]) => `<button data-m="${m}" class="${m === pr.mode ? 'on' : ''}"${m === 'country' && byType(e.t).filter(x => x.c === e.c && (e.t !== 'city' || x.pop >= CITY_MIN)).length < 3 ? ' disabled title="Too few entries in this country"' : ''}${m === 'gdp' && !(e.gdp > 0) ? ' disabled title="No GDP figure for this entry"' : ''}><b>${l}</b></button>`).join('')}</div>${e.t === 'country' && !(e.gdp > 0) ? `<p class="muted" style="font-size:13.5px;margin:6px 0 0">“Similar GDP” is switched off because the Tracker has no GDP figure for ${esc(nm(e))}.</p>` : ''}
    <p class="muted mt1">Compared with ${pr.mode === 'size' ? '' : pr.mode === 'world' && e.t === 'company' ? 'all ' : 'the '}${fmt(px.length)} ${esc(pr.label)}. ${esc(peerBasis(e))}${peerBasis(e) ? ' ' : ''}Bars show the share of peers that meet each check. The right-hand column shows ${esc(e.n)}.</p>
    <table class="gap-chart peer" style="max-width:900px">${peerRows.map(([lab, fn, me]) => { const v = pct(px.filter(fn).length, px.length); return `<tr><td class="q" style="width:45%">${esc(lab)}</td><td><div class="hb"><div class="tr"><i style="width:${v}%"></i></div><span>${v}%</span></div></td><td style="width:190px;max-width:190px;font-weight:700;color:${me ? 'var(--ok)' : 'var(--bad)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(e.n)}">${me ? '✓ ' : '✗ '}${esc(shortName(e))}</td></tr>`; }).join('')}</table>`}
  </div></section>

  <section class="tight"><div class="wrap">
    <div><h2 class="h-brand" style="font-size:24px">Questions to ask</h2><p class="muted mt0">Generated from the gaps above. Use them in consultations, AGMs, council meetings or interviews.</p>
      <ol class="asks">${asks(e).map(([q, s]) => `<li>${esc(q)}<small>${esc(s)}</small></li>`).join('')}</ol></div>
  </div></section>
  <section class="tight" id="share-box"><div class="wrap"><div class="accs">
    <div id="str-sec" hidden><details class="sharedd" id="fx-dd"><summary><b class="acc-t" id="fx-title">See the effects of climate change here</b><span class="acc-s" id="fx-sub">How much warmer it has become since 1850, one stripe per year.</span></summary>
      <div class="mt2" id="fx-body"><p class="muted">Loading…</p></div>
    </details></div>
    <details id="share-dd" class="sharedd"><summary><b class="acc-t">Share it, or write to someone who can act</b><span class="acc-s">Post about this profile, download a picture card, or draft an email to a policymaker, in 17 languages.</span></summary>
      <div id="sh-out" class="mt2"></div></details>
  </div></div></section>

  <section class="tight band"><div class="wrap">
    <h2 class="h-brand" style="font-size:24px">Sources and other views</h2>
    <div class="srcs mt1">
      <div class="card"><h4>Primary source</h4><p>The document our researchers used for this entry.</p>${e.src ? `<a href="${esc(e.src)}" target="_blank" rel="noopener">Open source document ↗</a>` : '<span class="muted">Not listed</span>'}</div>
      ${e.cat ? `<div class="card"><h4>Climate Action Tracker</h4><p>Independent rating of this net zero target: <b>${esc(e.cat)}</b>.</p>${e.catu ? `<a href="${esc(e.catu)}" target="_blank" rel="noopener">See assessment ↗</a>` : ''}</div>` : ''}
      ${e.clw ? `<div class="card"><h4>Climate Change Laws of the World</h4><p>The country's climate laws and policies.</p><a href="${esc(e.clw)}" target="_blank" rel="noopener">Country profile ↗</a></div>` : ''}
      ${e.eciu ? `<div class="card"><h4>ECIU Net Zero Scorecard</h4><p>Benchmarks national net zero targets. Status of this entry: <b>${esc(e.eciu)}</b>.</p><a href="https://eciu.net/netzerotracker" target="_blank" rel="noopener">Open the scorecard ↗</a></div>` : ''}
      <div class="card"><h4>Is this out of date?</h4><p>Entry last updated ${esc(e.upd || 'n/a')}. Our researchers review submissions.</p><a href="https://form.typeform.com/to/ZyfGb9tZ" target="_blank" rel="noopener">Request an update ↗</a></div>
    </div>
    <div class="cite mt2"><b>Cite this entry:</b> Net Zero Tracker (${(e.upd||'').slice(0,4) || NOW}). <i>${esc(e.n)}</i>. Energy &amp; Climate Intelligence Unit, Data-Driven EnviroLab, NewClimate Institute and Oxford Net Zero. ${official(e)}</div>
  </div></section>`;
};
P.entity.after = (params, slug) => {
  const e = BY[slug]; if (!e) return;
  effectsShow(e);
  localeMapShow(e);
  const renderE = () => { const html = emisChart(e); if (!html) return false;
    $('#emis').innerHTML = html; const se = viewSeries(e, EPC.on && e.t !== 'company' && hasPop(e));
    $$('#emis [data-pc]').forEach(b => b.onclick = () => { EPC.on = b.dataset.pc === '1'; (EPC.on ? loadPop() : Promise.resolve()).then(renderE); });
    $('#emis-lede').textContent = `How greenhouse gas emissions ${se.pc ? 'per person ' : ''}${e.c === 'EUU' ? 'in the European Union (its 27 current members)' : e.t === 'company' ? 'of ' + e.n : e.t === 'region' ? 'in ' + placeName(e) : 'in ' + nm(e)} have changed since ${se.y0}${!se.pc && (isNZ(e) || iyear(e)) ? ', and what the target would require from here' : ''}.`;
    emisWire(e); return true; };
  Promise.all([loadEmis(), EPC.on ? loadPop() : null]).then(([E]) => { if (!E || location.hash.indexOf('/e/' + slug) < 0) return; if (renderE()) $('#emis-sec').hidden = false; });
  $('#b-cmp').onclick = () => { let a = compareSet.get(); if (a.includes(e.s)) { location.hash = '#/compare'; return; } a = [...a, e.s].slice(-4); compareSet.set(a); $('#b-cmp').textContent = '✓ In comparison: view'; toast(`Added. ${a.length} in comparison.`); };
  { const dd = $('#share-dd'), open = () => { if (!dd.dataset.r) { dd.dataset.r = '1'; renderShare(e); } };
    dd.addEventListener('toggle', () => { if (dd.open) open(); });
    $('#b-share').onclick = () => { dd.open = true; open(); $('#share-box').scrollIntoView({behavior:'smooth', block:'start'}); }; }
  $('#b-link').onclick = () => copy(location.href);
  $$('#peerseg button').forEach(b => b.onclick = () => { PM[e.t] = b.dataset.m; const y = scrollY; route(); scrollTo(0, y); });
  if ($('#s-peer')) wireSearch('s-peer', o => { if (o.s === e.s) return; compareSet.set([e.s, o.s]); location.hash = '#/compare'; }, x => x.t === 'city' && x.s !== slug);
};

/* ---------- COMPARE ---------- */


/* ---------- share a chart: post, copy link, or download a picture ---------- */
function shareBarHtml(id){
  return `<div class="sharebar" id="${id}"><button type="button" class="btn btn-ghost btn-sm" data-act="toggle" aria-expanded="false">Share ▾</button><div class="sharemenu" hidden>
    <a data-act="x" target="_blank" rel="noopener">Post on X</a><a data-act="bs" target="_blank" rel="noopener">Bluesky</a><a data-act="fb" target="_blank" rel="noopener">Facebook</a><a data-act="li" target="_blank" rel="noopener">LinkedIn</a><button type="button" data-act="link">Copy link</button><button type="button" data-act="img">Download picture</button></div></div>`;
}
function svgToPng(svg, title, name){
  const vb = svg.viewBox.baseVal, W = vb.width, H = vb.height, TOP = 44, BOT = 30, c = svg.cloneNode(true);
  c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', W); c.setAttribute('height', H); c.setAttribute('style', 'font-family:Outfit,Helvetica,Arial,sans-serif');
  c.querySelectorAll('[opacity="0"]').forEach(n => n.remove());
  const xml = new XMLSerializer().serializeToString(c), img = new Image(), url = URL.createObjectURL(new Blob([xml], {type: 'image/svg+xml;charset=utf-8'}));
  img.onload = () => { const k = 2, cv = document.createElement('canvas'); cv.width = W * k; cv.height = (H + TOP + BOT) * k; const g = cv.getContext('2d'); g.scale(k, k);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H + TOP + BOT); g.fillStyle = '#271039'; g.font = '700 20px Outfit, Helvetica, Arial, sans-serif'; g.fillText(title.slice(0, 90), 16, 30);
    g.drawImage(img, 0, TOP, W, H); g.fillStyle = '#5f5869'; g.font = '13px Outfit, Helvetica, Arial, sans-serif'; g.fillText('Net Zero Tracker (design prototype). Sources: ' + (name.includes('timeline') ? 'Net Zero Tracker' : /^warming-stripes/.test(name) ? 'Berkeley Earth (CC BY-NC 4.0)' : /^(projected-warming|hot-days|rainfall-change)/.test(name) ? 'World Bank Climate Change Knowledge Portal, CMIP6' : /^global-warming/.test(name) ? 'Berkeley Earth (CC BY-NC 4.0)' : /^global-co2/.test(name) ? 'NOAA Global Monitoring Laboratory' : /^global-disasters/.test(name) ? 'EM-DAT via Our World in Data' : /^sea-level/.test(name) ? 'PSMSL tide gauges' : /^disaster-damage/.test(name) ? 'EM-DAT via Our World in Data' : 'Our World in Data, EDGAR v8.0'), 16, H + TOP + 20);
    URL.revokeObjectURL(url); const a = document.createElement('a'); a.download = name + '.png'; a.href = cv.toDataURL('image/png'); a.click(); };
  img.src = url;
}
function shareWire(id, cfg){
  const box = document.getElementById(id); if (!box) return; const menu = $('.sharemenu', box), btn = $('[data-act=toggle]', box), q = encodeURIComponent;
  const upd = () => { const t = cfg.text().replace(/\s+/g, ' ').trim(), t2 = t.length > 250 ? t.slice(0, 249).trim() + '…' : t, u = cfg.url();
    $('[data-act=x]', box).href = `https://twitter.com/intent/tweet?text=${q(t2)}&url=${q(u)}`; $('[data-act=bs]', box).href = `https://bsky.app/intent/compose?text=${q(t2 + ' ' + u)}`;
    $('[data-act=fb]', box).href = `https://www.facebook.com/sharer/sharer.php?u=${q(u)}`; $('[data-act=li]', box).href = `https://www.linkedin.com/sharing/share-offsite/?url=${q(u)}`; };
  btn.onclick = ev => { ev.stopPropagation(); upd(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); };
  document.addEventListener('click', ev => { if (!box.contains(ev.target)) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  $('[data-act=link]', box).onclick = () => { copy(cfg.url()); menu.hidden = true; };
  $('[data-act=img]', box).onclick = () => { const sv = cfg.svg(); if (sv) svgToPng(sv, cfg.title(), cfg.name); else toast('Nothing to download yet'); menu.hidden = true; };
}
/* ---------- COMPARE: shared timeline of milestones and targets ---------- */
function tlPoints(e){
  const ms = msList(e).filter(([yr]) => yr >= NOW && yr <= 2100).map(([yr, l]) => ({yr, l, k:'ms'}));
  const y = year(e), pts = ms.slice();
  if (y && y >= NOW && y <= 2100 && hasAnyTarget(e)) pts.push({yr:y, l:targetPhrase(e), k:'end', nz:isNZ(e)});
  return {pts, passed: y && y < NOW && hasAnyTarget(e) ? y : null};
}
function tlTip(e, p){ return `<div class="tipms"><b>${esc(e.n)}</b><div class="mrow"><span class="my">${p.yr}</span><span>${esc(p.l)}${p.k === 'end' ? `<em> · end target, ${p.yr - NOW} years away</em>` : ''}</span></div></div>`; }
function compareTimeline(es){
  const L = es.map(e => ({e, ...tlPoints(e)}));
  window.__tl = L;
  const maxY = Math.max(2050, ...L.flatMap(r => r.pts.map(p => p.yr)));
  const end = Math.min(2100, Math.ceil((maxY + 1) / 5) * 5);
  const W = 960, X0 = 200, X1 = 925, x = v => X0 + (v - NOW) / (end - NOW) * (X1 - X0), RH = 78, TOP = 38, H = TOP + RH * es.length + 14;
  const ticks = []; for (let t = NOW; t <= end; t += 1) if (t % 5 === 0 || t === NOW) ticks.push(t);
  const cw = (txt, sz) => txt.length * sz * 0.56;
  const short = (t, n) => t.length > n ? t.slice(0, n - 1).trim() + '…' : t;
  const name = e => { const w = (e.t === 'city' ? e.n.replace(/\s*\(.*\)/, '') : e.n).split(' '); let a = '', b = ''; w.forEach(x => { if ((a + ' ' + x).trim().length <= 20 && !b) a = (a + ' ' + x).trim(); else b = (b + ' ' + x).trim(); }); return [a, short(b, 22)]; };
  const lanes = L.map((r, i) => {
    const by = TOP + RH * i + 54, e = r.e, nz = r.pts.filter(p => p.k === 'end')[0], last = nz ? nz.yr : (r.pts.length ? r.pts[r.pts.length - 1].yr : null);
    const tiers = [-1e9, -1e9, -1e9], nm = name(e);
    const ptHtml = r.pts.map((p, j) => {
      const px = x(p.yr);
      const data = `data-li="${i}" data-pj="${j}" role="img" aria-label="${esc(e.n + ', ' + p.yr + ': ' + p.l)}"`;
      if (p.k === 'ms') {
        const lab = p.yr + ': ' + short(p.l, 24), w = cw(lab, 11.5), flip = px + w > X1 + 30; let t = 0; const from = flip ? px - w : px;
        while (t < 2 && tiers[t] > from - 6) t++;
        tiers[t] = flip ? px : px + w;
        return `<g class="tlp" ${data}><line x1="${px}" x2="${px}" y1="${by}" y2="${by - 14 - t * 14 + 3}" stroke="#d9c9a3"/><circle cx="${px}" cy="${by}" r="7" fill="#c27a00" stroke="#fff" stroke-width="2"/><text x="${px}" y="${by - 14 - t * 14}" text-anchor="${flip ? 'end' : 'start'}" font-size="11.5" fill="#7a4a00" font-weight="600">${esc(lab)}</text></g>`;
      }
      const col = p.nz ? '#3B7CC3' : '#8a6a3d', lab = short(p.l, 26), flip = px > X1 - 170;
      return `<g class="tlp" ${data}><path d="M${px} ${by - 10} L${px + 10} ${by} L${px} ${by + 10} L${px - 10} ${by} Z" fill="${col}" stroke="#fff" stroke-width="2"/><text x="${flip ? px - 6 : px + 6}" y="${by + 21}" text-anchor="${flip ? 'end' : 'start'}" font-size="12.5" font-weight="700" fill="${col}" paint-order="stroke" stroke="#fff" stroke-width="3.5" stroke-linejoin="round">${esc(lab)}</text></g>`;
    }).join('');
    const note = !r.pts.length ? `<text x="${x(NOW) + 18}" y="${by + 4}" font-size="13" fill="#7a7385" font-style="italic">${r.passed ? 'Target year ' + r.passed + ' has already passed' : hasAnyTarget(e) ? 'No dated milestones' : 'No target'}</text>` : '';
    return `<g class="tl-lane">
      <rect x="0" y="${TOP + RH * i + 6}" width="${W}" height="${RH - 8}" fill="transparent"/>
      <a href="#/e/${e.s}"><text x="14" y="${by - (nm[1] ? 12 : 3)}" font-size="14" font-weight="800" fill="#271039">${esc(nm[0])}</text>${nm[1] ? `<text x="14" y="${by + 4}" font-size="14" font-weight="800" fill="#271039">${esc(nm[1])}</text>` : ''}<text x="14" y="${by + (nm[1] ? 19 : 13)}" font-size="11.5" fill="#6d6677">${TYPE[e.t][0]}${e.cn && e.t !== 'country' ? ' · ' + esc(short(e.cn, 16)) : ''}</text></a>
      <line x1="${x(NOW)}" x2="${X1}" y1="${by}" y2="${by}" stroke="#dcdcdc" stroke-width="6" stroke-linecap="round"/>
      ${last ? `<line x1="${x(NOW)}" x2="${x(last)}" y1="${by}" y2="${by}" stroke="${nz && nz.nz ? '#b2d49b' : '#e6d6bd'}" stroke-width="6" stroke-linecap="round"/>` : ''}
      <circle cx="${x(NOW)}" cy="${by}" r="7" fill="#271039" stroke="#fff" stroke-width="2"><title>Today, ${NOW}</title></circle>
      ${note}${ptHtml}</g>`;
  }).join('');
  const grid = ticks.map(t => `<line x1="${x(t)}" x2="${x(t)}" y1="${TOP - 6}" y2="${H - 10}" stroke="#e6e2ea" stroke-width="1"/><text x="${x(t)}" y="${TOP - 12}" text-anchor="middle" font-size="12" fill="${t === NOW ? '#271039' : '#7a7385'}" font-weight="${t === NOW ? 800 : 500}">${t === NOW ? 'Today' : t}</text>`).join('');
  const ref = [[2030, '2030'], [2050, '2050']].filter(([v]) => v <= end).map(([v, l]) => `<line x1="${x(v)}" x2="${x(v)}" y1="${TOP - 6}" y2="${H - 10}" stroke="#5EA845" stroke-width="2" stroke-dasharray="5 4"/>`).join('');
  const bg = es.map((e, i) => `<rect x="0" y="${TOP + RH * i + 6}" width="${W}" height="${RH - 8}" rx="8" fill="${i % 2 ? '#fff' : '#f4f3f7'}"/>`).join('');
  return `<section class="tight"><div class="wrap"><div class="shead"><h2 class="h-brand" style="font-size:24px">Timeline of milestones and targets</h2>${shareBarHtml('sh-tl')}</div>
    <p class="muted mt0">One row per entry. <b style="color:#7a4a00">Dots</b> are interim milestones, <b style="color:#3B7CC3">diamonds</b> are end targets. The dashed green lines mark 2030 and 2050, the years the UN climate science panel uses for a 1.5°C path (about 45% cut by 2030, net zero around 2050).</p>
    <div class="tlwrap"><svg viewBox="0 0 ${W} ${H}" class="tlsvg" role="group" aria-label="Timeline comparing milestones and targets for ${es.map(e => esc(e.n)).join(', ')}">${bg}${bg}${grid}${ref}${lanes}</svg></div></div></section>`;
}
function wireTl(){}  // no hover details on the timeline markers

/* ---------- COMPARE: emissions of all selected entries on one chart ---------- */
const CMP_COL = ['#3B7CC3', '#E13B26', '#5EA845', '#8a6a3d'];
function cmpEmisHtml(es, st){
  const pc = st.mode === 'pc', L = es.map((e, i) => ({e, se: pc ? (e.t === 'company' ? null : viewSeries(e, hasPop(e))) : emisSeries(e), c: CMP_COL[i % 4]})).filter(r => r.se && (!pc || r.se.pc));
  if (!L.length) { if (pc) { st.mode = 'abs'; return cmpEmisHtml(es, st); } return ''; }
  const idx = st.mode === 'idx', allC = L.every(r => r.se.kind === 'c');
  let x0 = Math.max(...L.map(r => r.se.y0)); if (st.from === '1970') x0 = Math.max(x0, 1970); if (idx) x0 = Math.max(x0, 1990);
  const dataEnd = Math.max(...L.map(r => r.se.y0 + r.se.v.length - 1));
  // each entry's own target path: straight lines from its latest figure to its milestone and to net zero (illustrative)
  const TG = L.map(r => { if (pc) return null; const e = r.e, v = r.se.v, y0 = r.se.y0, yL = y0 + v.length - 1, vL = v[v.length - 1], ib = parseInt(e.ib), ip = +e.ip, iy = iyear(e), nz = isNZ(e) ? year(e) : null;
    const base = ib >= y0 && ib <= yL ? v[ib - y0] : null, pts = [[yL, vL]];
    if (base && iy && ip > 0 && iy > yL && iy <= 2100) pts.push([iy, base * (1 - ip / 100), 'ms']);
    if (nz && nz > yL && nz <= 2100 && (!pts[1] || nz > pts[1][0])) pts.push([nz, 0, 'nz']);
    return pts.length > 1 ? pts : null; });
  const x1 = st.paths === false ? dataEnd : Math.min(2100, Math.max(dataEnd, ...TG.flat().filter(Array.isArray).length ? TG.filter(Boolean).flatMap(p => p.map(q => q[0])) : [dataEnd]));
  const vals = r => { const o = []; for (let y = x0; y <= r.se.y0 + r.se.v.length - 1; y++) { const v = r.se.v[y - r.se.y0]; if (v == null) continue; o.push([y, idx ? (v / r.se.v[1990 - r.se.y0] - 1) * 100 : v]); } return o; };
  const S2 = L.map(r => ({...r, pts: vals(r)}));
  const conv = (r, v) => idx ? (v / r.se.v[1990 - r.se.y0] - 1) * 100 : v;
  S2.forEach((r, i) => { r.tg = st.paths === false || !TG[i] ? null : TG[i].map(p => [p[0], conv(r, p[1]), p[2]]); });
  for (let i = S2.length - 1; i >= 0; i--) if (!S2[i].pts.length || S2[i].pts.some(p => !isFinite(p[1]))) S2.splice(i, 1);
  if (!S2.length) return '';
  const W = chartW(), H = W < 600 ? 300 : 340, Lm = 64, Rm = W < 600 ? 96 : 150, T = 46, B = 36, allv = S2.flatMap(r => r.pts.map(p => p[1]).concat((r.tg || []).map(p => p[1]))), ymax = Math.max(...allv, idx ? 10 : 0) * 1.08, ymin = idx ? Math.min(0, ...allv) * 1.08 : 0;
  const x = yr => Lm + (yr - x0) / (x1 - x0) * (W - Lm - Rm), y = v => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  const step = (x1 - x0) > 120 ? 25 : (x1 - x0) > 50 ? 10 : 5, ticks = []; for (let t = Math.ceil(x0 / step) * step; t <= x1; t += step) ticks.push(t);
  const nice = (ymax - ymin) / 4, mag = 10 ** Math.floor(Math.log10(nice)), ny = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= nice), yt = []; for (let t = Math.ceil(ymin / ny) * ny; t <= ymax; t += ny) yt.push(t);
  const pf = t => idx ? (t > 0 ? '+' : t < 0 ? '−' : '') + fmt(Math.abs(t)) + '%' : fmt(t);
  // direct labels at the right end, spread apart
  const ends = S2.map(r => ({r, yy: y((r.tg ? r.tg[r.tg.length - 1] : r.pts[r.pts.length - 1])[1])})).sort((a, b) => a.yy - b.yy); for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 17) ends[i].yy = ends[i - 1].yy + 17; { const over = ends[ends.length - 1].yy - (H - B + 4); if (over > 0) { ends.forEach(e => { e.yy -= over; }); for (let i = ends.length - 2; i >= 0; i--) if (ends[i + 1].yy - ends[i].yy < 17) ends[i].yy = ends[i + 1].yy - 17; } }
  const nameOf = e => (e.t === 'city' ? e.n.replace(/\s*\(.*\)/, '') : e.n);
  const svg = `<svg viewBox="0 0 ${W} ${H}" id="cmpe-svg" data-x0="${x0}" data-x1="${x1}" data-t="${T}" data-b="${B}" data-h="${H}" data-lm="${Lm}" data-rm="${Rm}" data-w="${W}" role="img" aria-label="Emissions of ${S2.map(r => esc(r.e.n)).join(', ')}" style="width:100%;height:auto;display:block">
    ${yt.map(t => `<line x1="${Lm}" x2="${W - Rm}" y1="${y(t)}" y2="${y(t)}" stroke="#ece8ef"/><text x="${Lm - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="#7a7385">${pf(t)}</text>`).join('')}
    ${ticks.map(t => `<text x="${x(t)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="#7a7385">${t}</text>`).join('')}
    <text x="14" y="13" font-size="12" fill="#7a7385">${idx ? 'Change since 1990' : pc ? 't CO₂e per person a year' : 'Mt CO₂e per year'}</text>
    ${pmarks(x, x0, x1, T, H - B, 'lines')}
    ${idx ? `<line x1="${Lm}" x2="${W - Rm}" y1="${y(0)}" y2="${y(0)}" stroke="#9a93a6" stroke-dasharray="4 4"/>` : ''}
    ${S2.map(r => `<path d="${r.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join('')}" fill="none" stroke="${r.c}" stroke-width="2.8" stroke-linejoin="round"/>`).join('')}
    ${S2.map(r => r.tg ? `<path d="${r.tg.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join('')}" fill="none" stroke="${r.c}" stroke-width="2.4" stroke-dasharray="6 5"/>${r.tg.slice(1).map(p => p[2] === 'nz' ? `<path d="M${x(p[0])} ${y(p[1]) - 8} l8 8 l-8 8 l-8 -8z" fill="${r.c}" stroke="#fff" stroke-width="2"><title>${esc(r.e.n)}: net zero ${p[0]}</title></path>` : `<circle cx="${x(p[0])}" cy="${y(p[1])}" r="5.5" fill="${r.c}" stroke="#fff" stroke-width="2"><title>${esc(r.e.n)}: milestone ${p[0]}</title></circle>`).join('')}` : '').join('')}
    ${ends.map(({r, yy}) => { const lp = r.tg ? r.tg[r.tg.length - 1] : r.pts[r.pts.length - 1], dp = r.pts[r.pts.length - 1]; return `<circle cx="${x(dp[0])}" cy="${y(dp[1])}" r="4.5" fill="${r.c}" stroke="#fff" stroke-width="2"/><text x="${x(x1) + 12}" y="${yy + 4}" font-size="12.5" font-weight="700" fill="${r.c}">${esc(nameOf(r.e).slice(0, W < 600 ? 11 : 18))}</text>`; }).join('')}
    <line id="cmpe-x" y1="${T}" y2="${H - B}" stroke="#271039" opacity="0"/>
    <rect id="cmpe-hit" x="${Lm}" y="${T}" width="${W - Lm - Rm}" height="${H - T - B}" fill="transparent"/>${pmarks(x, x0, x1, T, H - B, 'labels')}</svg>`;
  const missing = es.filter(e => !emisSeries(e)).map(e => e.n);
  const mixed = new Set(S2.map(r => r.se.kind)).size > 1;
  window.__cmpe = {S2, x0, x1, idx, pc};
  return `<div class="emis-ctl"><div class="seg segs" id="cmpe-mode" role="group" aria-label="Scale"><button data-m="abs" class="${idx || pc ? '' : 'on'}"><b>Total</b></button>${es.some(e => e.t !== 'company') ? `<button data-m="pc" class="${pc ? 'on' : ''}"><b>Per person</b></button>` : ''}<button data-m="idx" class="${idx ? 'on' : ''}"><b>Change since 1990</b></button></div>
    ${TG.some(Boolean) ? `<div class="seg segs" id="cmpe-paths" role="group" aria-label="Target paths"><button data-p="1" class="${st.paths === false ? '' : 'on'}"><b>With target paths</b></button><button data-p="0" class="${st.paths === false ? 'on' : ''}"><b>History only</b></button></div>` : ''}
    ${allC && !idx ? `<div class="seg segs" id="cmpe-from" role="group" aria-label="Period"><button data-f="all" class="${st.from === 'all' ? 'on' : ''}"><b>Since ${Math.max(...L.map(r => r.se.y0))}</b></button><button data-f="1970" class="${st.from === '1970' ? 'on' : ''}"><b>Since 1970</b></button></div>` : ''}</div>
    <div class="card emis">${svg}<div class="emis-key">${S2.map(r => `<span><i style="background:${r.c}"></i>${esc(r.e.n)}</span>`).join('')}${S2.some(r => r.tg) ? '<span><i class="dash" style="border-top-color:#6d6677"></i>Straight-line path to each target (illustrative)</span>' : ''}</div>
    <p class="muted emis-src">${pc ? 'Per person: countries are divided by each year\'s population (Our World in Data); regions and cities by today\'s population, so their earlier years are only indicative. Companies are left out, and target paths are shown only for totals. ' : ''}${mixed ? 'Countries come from Our World in Data (including land use and forestry) and cities and regions from EDGAR v8.0 (without land use), so their levels are not strictly comparable. The change view shows how each has moved. ' : ''}${missing.length ? `No emissions series for ${esc(missing.join(', '))}. ` : ''}${L.some(r => r.e.t === 'company') ? 'Company figures are worldwide Scope 1 and 2 emissions, reported by the company (via Wikirate) or estimated by Climate TRACE, so they are not comparable with the totals for places' + (idx ? '; the change view leaves companies out because there is no 1990 figure' : '') + '. ' : ''}${idx ? 'Change is measured from 1990, so places of very different sizes can be compared. ' : ''}<a href="#/notes/emissions">How this was built</a>.</p></div>`;
}
function cmpEmisWire(es, st){
  const box = $('#cmpe'); if (!box) return;
  const draw = () => { box.innerHTML = cmpEmisHtml(es, st); wire(); };
  const wire = () => {
    $$('#cmpe-mode button').forEach(b => b.onclick = () => { st.mode = b.dataset.m; (st.mode === 'pc' ? loadPop() : Promise.resolve()).then(draw); });
    $$('#cmpe-from button').forEach(b => b.onclick = () => { st.from = b.dataset.f; draw(); });
    $$('#cmpe-paths button').forEach(b => b.onclick = () => { st.paths = b.dataset.p === '1'; draw(); });
    const svg = $('#cmpe-svg'), hit = $('#cmpe-hit'), vx = $('#cmpe-x'); if (!svg) return;
    treatyWire(svg, es);
    hit.addEventListener('mousemove', ev => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const {S2, x0, x1, idx, pc} = window.__cmpe, hx = +hit.getAttribute('x'), hw = +hit.getAttribute('width'), yr = Math.round(x0 + Math.max(0, Math.min(1, (p.x - hx) / hw)) * (x1 - x0));
      const X = hx + (yr - x0) / (x1 - x0) * hw; vx.setAttribute('x1', X); vx.setAttribute('x2', X); vx.setAttribute('opacity', .3);
      const val = v => idx ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(0) + '%' : (Math.abs(v) < 1e-9 ? '0' : fmtMt(v)) + (pc ? ' t' : ' Mt');
      // past the history, read the value off the entry's dashed target path
      const onPath = r => { const t = r.tg; if (!t || yr <= t[0][0] || yr > t[t.length - 1][0]) return null;
        for (let i = 1; i < t.length; i++) if (yr <= t[i][0]) { const [ya, va] = t[i - 1], [yb, vb, k] = t[i]; return {v: va + (vb - va) * (yr - ya) / (yb - ya), k: yr === yb ? k : null}; } return null; };
      let anyPath = false;
      const rows = S2.map(r => { const q = r.pts.find(pp => pp[0] === yr), dot = `<span class="my" style="color:${r.c}">●</span>`;
        if (q) return `<div class="mrow">${dot}<span>${esc(r.e.n)}: <b>${val(q[1])}</b></span></div>`;
        const o = onPath(r); if (!o) return ''; anyPath = true;
        return `<div class="mrow">${dot}<span>${esc(r.e.n)}: <b>${val(o.v)}</b> ${o.k === 'nz' ? '(net zero target)' : o.k === 'ms' ? '(milestone)' : '(on target path)'}</span></div>`; }).join('');
      showTip(`<div class="tipms"><b>${yr}</b>${rows || '<div class="mrow muted">No figures for this year</div>'}${anyPath ? '<div class="muted" style="font-size:12px;margin-top:4px">Target-path values are a straight line, for illustration only.</div>' : ''}</div>`, ev);
    });
    hit.addEventListener('mouseleave', () => { hideTip(); vx.setAttribute('opacity', 0); });
  };
  draw();
}
P.compare = (params) => {
  if (params.ids) compareSet.set(params.ids.split(',').filter(s => BY[s]).slice(0,4));
  let ids = compareSet.get();
  if (!ids.length) { ids = ['United Kingdom','Germany','India','China'].map(n => slugOf(n,'country')).filter(Boolean); }
  const es = ids.map(s => BY[s]);
  const C = es.map(checks);
  const row = (lab, f) => `<tr><td>${lab}</td>${es.map((e,i) => `<td>${f(e,i)}</td>`).join('')}</tr>`;
  return `<section class="tight band"><div class="wrap">
    <h1 class="h-brand" style="font-size:clamp(28px,4vw,40px)">Compare side by side</h1>
    <p class="lede mt0">Add up to 4 countries, regions, cities or companies. Mixing types works, for example a city and its country.</p>
    <div class="mt1">${es.map(e => `<span class="chip">${typeBadge(e.t, e)} ${esc(e.n)} <button aria-label="Remove ${esc(e.n)}" data-rm="${e.s}">×</button></span>`).join('')}</div>
    <div class="light mt1" style="max-width:520px">${searchBox('s-cmp', es.length >= 4 ? 'Remove one to add another (max 4)' : 'Add an entry…')}</div>
    ${compareSet.get().length ? '' : '<p class="muted" style="font-size:14px">Showing an example. Add your own to replace it.</p>'}
  </div></section>
  <section class="tight"><div class="wrap"><div class="tablewrap" style="border:0"><table class="cmp">
    <thead><tr><th></th>${es.map(e => `<th><a href="#/e/${e.s}" style="color:inherit">${e.t==='country'?flag(e.a2)+' ':''}${esc(e.n)}</a><div style="font-weight:400;font-size:13px">${typeWord(e)}${e.cn && e.t!=='country' ? ' · ' + esc(e.cn) : ''}</div></th>`).join('')}</tr></thead>
    <tbody>
      <tr class="grp"><td colspan="${es.length+1}">Headline</td></tr>
      ${row('Target', e => `<b>${esc(targetPhrase(e))}</b>`)}
      ${row('How firm?', e => pill(e))}
      ${row('Next milestone', e => e.it && e.it !== 'No target' ? esc((e.ip ? e.ip + '% cut' : e.it) + (iyear(e) ? ' by ' + iyear(e) : '') + (e.ib ? ' vs ' + e.ib : '')) : '<span class="muted">None</span>')}
      ${row('Credibility checks met', (e,i) => isNZ(e) ? `<b style="font-size:20px">${tally(C[i]).yes}</b> of ${C[i].length}` : '<span class="muted">No net zero target</span>')}
      ${PILLARS.map(p => `<tr class="grp"><td colspan="${es.length+1}">${p.name}</td></tr>` + [...new Set(C.flat().filter(c => c.p === p.id).map(c => c.id))].map(id => { const q = C.flat().find(c => c.id === id).q; return row(q, (e,i) => { const c = C[i].find(k => k.id === id); return c ? `<div class="cell">${vtag(c.v)}<span>${esc(c.a)}</span></div>` : '<span class="muted">Not applicable</span>'; }); }).join('')).join('')}
    </tbody></table></div>
    <div class="actions"><button class="btn btn-ghost btn-sm" id="cmp-link">Copy link to this comparison</button></div>
  </div></section>
  <section class="tight" id="cmpe-sec" hidden><div class="wrap"><div class="shead"><h2 class="h-brand" style="font-size:24px">Emissions history</h2>${shareBarHtml('sh-emis')}</div><p class="muted mt0">Greenhouse gas emissions of the selected entries on one chart. Hover for the values in each year.</p><div id="cmpe"></div></div></section>
  ${compareTimeline(es)}`;
};
P.compare.after = () => {
  wireTl();
  { const ids = () => compareSet.get().length ? compareSet.get() : $$('[data-rm]').map(x => x.dataset.rm), ents = () => ids().map(i => BY[i]).filter(Boolean), url = () => location.href.split('#')[0] + '#/compare?ids=' + ids().join(','), names = () => ents().map(e => e.n).join(', ');
    shareWire('sh-emis', {url, name: 'emissions-comparison', title: () => 'Emissions: ' + names(), svg: () => $('#cmpe-svg'),
      text: () => { const L = (window.__cmpe || {}).S2 || []; return `Greenhouse gas emissions compared: ${L.map(r => { const p = r.pts[r.pts.length - 1]; return `${r.e.n} ${window.__cmpe.idx ? (p[1] > 0 ? '+' : '−') + Math.abs(p[1]).toFixed(0) + '% since 1990' : fmtMt(p[1]) + ' Mt in ' + p[0]}`; }).join('; ')}. #NetZero #ClimateAction`; }});
    shareWire('sh-tl', {url, name: 'targets-timeline', title: () => 'Net zero targets and milestones: ' + names(), svg: () => $('.tlsvg'),
      text: () => `Net zero targets compared: ${ents().map(e => `${e.n}: ${targetPhrase(e)}`).join('; ')}. #NetZero #ClimateAction`}); }
  { const ids = compareSet.get().length ? compareSet.get() : $$('[data-rm]').map(x => x.dataset.rm), es2 = ids.map(i => BY[i]).filter(Boolean), st = {mode:'abs', from:'all'};
    loadEmis().then(E => { if (!E || location.hash.indexOf('/compare') < 0) return; if (!es2.some(e => emisSeries(e))) return; $('#cmpe-sec').hidden = false; cmpEmisWire(es2, st); }); }
  wireSearch('s-cmp', e => { const a = compareSet.get(); if (a.length >= 4 || a.includes(e.s)) return toast(a.includes(e.s) ? 'Already added' : 'Maximum of 4'); compareSet.set([...a, e.s]); route(); });
  $$('[data-rm]').forEach(b => b.onclick = () => { const cur = compareSet.get().length ? compareSet.get() : $$('[data-rm]').map(x => x.dataset.rm); compareSet.set(cur.filter(s => s !== b.dataset.rm)); history.replaceState(null, '', '#/compare'); route(); });
  $('#cmp-link').onclick = () => { const ids = compareSet.get().length ? compareSet.get() : $$('[data-rm]').map(x => x.dataset.rm); copy(location.href.split('#')[0] + '#/compare?ids=' + ids.join(',')); };
};

/* ---------- LEARN ---------- */
const GLOSS = [
  ['Greenhouse gas','A gas in the air, such as carbon dioxide or methane, that traps heat near the Earth’s surface.','These gases are why burning coal, oil and gas warms the planet. A target that counts only CO₂ leaves out others, such as methane, that also trap heat.'],
  ['Greenhouse effect','The way heat-trapping gases act like a blanket around the Earth. Some of this is natural and keeps the planet warm enough to live on; burning fossil fuels thickens it.','The more of these gases in the air, the more heat stays near the surface, so the planet keeps warming until the amount we add falls to zero.'],
  ['Net zero','Cutting emissions as close to zero as possible, then balancing the small remainder by removing the same amount of CO₂ from the air.','Scientists say global CO₂ must reach net zero around 2050 to limit warming to 1.5°C.'],
  ['Interim target','A nearer-term goal, usually for 2030 or 2035, on the way to net zero.','Without one, a 2050 promise cannot be checked until it is too late.'],
  ['Scope 1, 2 and 3','Scope 1: emissions from your own operations. Scope 2: from the electricity and heat you buy. Scope 3: everything else in your value chain, from suppliers to customers using your products.','For an oil company or a carmaker, Scope 3 is usually most of the footprint.'],
  ['Carbon offsets (credits)','Paying for someone else to reduce or absorb emissions, and counting it against your own.','Quality varies widely. Good practice is to cut first and never use offsets to meet interim targets.'],
  ['Carbon removal (CDR)','Taking CO₂ out of the air and storing it, through forests and soils (nature-based) or technology such as direct air capture (engineered).','Needed for the hardest leftover emissions, but limited and uncertain, so it is not a substitute for cuts.'],
  ['Residual emissions','The small amount of emissions left once everything feasible has been cut. Typically 10% or less of today’s level.','These are the only emissions that removals should balance.'],
  ['Carbon neutral vs net zero','Carbon neutral often allows offsets for any amount of emissions, and sometimes covers CO₂ only. Net zero (as defined by the UN and ISO) means deep cuts first.','We track both, but labels are not standardised, so check the details.'],
  ['Consumption emissions','Emissions caused by the goods and services a place consumes, including imports.','A country can lower its own emissions by importing more, so this closes a loophole.'],
  ['Just transition','Making sure workers and communities that depend on high-carbon industries are not left behind.','Increasingly expected in national plans and company strategies.'],
  ['Base year','The year that a percentage cut is measured against, such as "45% below 2010".','An early or high-emissions base year can make a target look bigger than it is.'],
];
const GHG_CAP = ['<b>Balanced.</b> A thin layer of greenhouse gas returns some heat to the ground and lets most escape. Heat in matches heat out, so the temperature stays steady and livable.', '<b>Out of balance.</b> A thicker layer sends more heat back down and lets less escape. More heat comes in than goes out, so the surface keeps warming.'];
const GHG_LEDE = ['Before we started burning coal, oil and gas, the Earth gave off about as much heat as it took in from the sun, so its temperature stayed steady.', 'Burning coal, oil and gas adds greenhouse gases to the air, which traps more of the Earth’s heat and warms the planet.'];
function ghgSvg(l){
  const W = 640, H = 400, G = 322;                       // canvas, ground line
  const cols = [262, 328, 394, 460];                     // heat columns
  const back = l ? [0, 1, 1, 1] : [0, 0, 0, 1];          // which columns are sent back down
  const B0 = 104, B1 = 184;                              // gas layer band
  const wave = (x, y0, y1) => {                          // vertical wavy line with tapered ends
    let d = `M${x} ${y0}`; const n = Math.abs(y1 - y0), s = Math.sign(y1 - y0);
    for (let t = 2; t <= n; t += 2) { const env = Math.min(1, t / 18, (n - t) / 18); d += `L${(x + 5 * env * Math.sin(t / 5)).toFixed(1)} ${y0 + s * t}`; }
    return d;
  };
  const heat = (x, i) => back[i]
    ? `<path class="hp hl s2" d="${wave(x, G - 6, 168)}"/><path class="hp hl s3" d="M${x} 168 A13 13 0 0 1 ${x + 26} 168 ${wave(x + 26, 168, G - 10).replace(/^M[^L]*/, '')}" marker-end="url(#ghg-ah)"/>`
    : `<path class="hp hl s2" d="${wave(x, G - 6, 22)}" marker-end="url(#ghg-ah)"/>`;
  // greenhouse-gas molecules (CO2-style glyphs), deterministic layout
  const mol = []; const n = l ? 30 : 9;
  for (let i = 0; i < n; i++) {
    const x = 24 + ((i + .5) / n) * 464 + ((i * .618034) % 1 - .5) * (232 / n), y = B0 + 20 + ((i * .7548776 + .3) % 1) * (B1 - B0 - 40), r = (i * 47) % 180;
    mol.push(`<g class="hl s3" transform="translate(${x} ${y}) rotate(${r})"><circle cx="-7" r="3.4" fill="#c8302a"/><circle cx="7" r="3.4" fill="#c8302a"/><circle r="4.6" fill="#3a3340"/></g>`);
  }
  const badge = (x, y, t) => `<g class="hl s${t}" data-step="${t}" style="cursor:pointer" transform="translate(${x} ${y})"><circle r="12" fill="#271039" stroke="#fff" stroke-width="2"/><text y="4.5" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${t}</text></g>`;
  const label = (x, y, a, b, c = '#3c3546') => `<text x="${x}" y="${y}" font-size="13" font-weight="600" fill="${c}">${a}${b ? `<tspan x="${x}" dy="16" font-weight="400" fill="#5f5869">${b}</tspan>` : ''}</text>`;
  // human activity on the land when there are more gases: factories, cars and cows
  const BY0 = 352;
  const puff = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#8a7a6a" opacity=".62"/>`;
  const fac = (x, w, n) => `<rect x="${x}" y="${BY0 - 18}" width="${w}" height="18" fill="#3d1f5a"/>${Array.from({length: n}, (_, i) => { const cx = x + 8 + i * 20; return `<rect x="${cx}" y="${BY0 - 36}" width="9" height="18" fill="#5b3f7a"/><rect x="${cx - 1.5}" y="${BY0 - 37}" width="12" height="3.5" fill="#271039"/>${puff(cx + 5, BY0 - 44, 4)}${puff(cx + 10, BY0 - 54, 5.5)}${puff(cx + 4, BY0 - 65, 6.5)}`; }).join('')}${[0, 1, 2, 3].map(i => `<rect x="${x + 6 + i * (w - 18) / 3}" y="${BY0 - 11}" width="5" height="4" fill="#FAA542"/>`).join('')}`;
  const car = (x, c) => `<rect x="${x}" y="${BY0 - 9}" width="34" height="7" rx="2.5" fill="${c}"/><path d="M${x + 8} ${BY0 - 9} L${x + 12} ${BY0 - 16} H${x + 24} L${x + 28} ${BY0 - 9}Z" fill="${c}"/><path d="M${x + 13} ${BY0 - 9} L${x + 15} ${BY0 - 14.5} H${x + 21} V${BY0 - 9}Z M${x + 22.5} ${BY0 - 9} V${BY0 - 14.5} H${x + 24} L${x + 26.5} ${BY0 - 9}Z" fill="#dbe8f4"/><circle cx="${x + 9}" cy="${BY0 - 2}" r="3.4" fill="#1c1622"/><circle cx="${x + 25}" cy="${BY0 - 2}" r="3.4" fill="#1c1622"/>${puff(x - 4, BY0 - 5, 2.6)}${puff(x - 9, BY0 - 9, 3.2)}`;
  const cow = x => `<g stroke="#271039" stroke-width="1"><rect x="${x + 3}" y="${BY0 - 17}" width="19" height="9" rx="4" fill="#fff"/><rect x="${x - 3}" y="${BY0 - 19}" width="8" height="7" rx="2.5" fill="#fff"/><path d="M${x + 6} ${BY0 - 8} v8 M${x + 10} ${BY0 - 8} v8 M${x + 16} ${BY0 - 8} v8 M${x + 20} ${BY0 - 8} v8" fill="none" stroke-width="1.6"/></g><circle cx="${x + 10}" cy="${BY0 - 14}" r="2.3" fill="#271039"/><circle cx="${x + 17}" cy="${BY0 - 12.5}" r="1.8" fill="#271039"/>${puff(x + 24, BY0 - 22, 2.8)}${puff(x + 29, BY0 - 29, 3.4)}`;
  const hum = l ? `<g aria-hidden="true">${fac(20, 82, 3)}${car(122, '#c8302a')}${car(166, '#3B7CC3')}${car(210, '#f2efe9')}${cow(300)}${cow(352)}${cow(404)}${fac(520, 62, 2)}</g>` : '';
  const outN = back.filter(v => !v).length, inN = 4 - outN;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagram of the greenhouse effect: ${outN} of 4 heat arrows escape to space and ${inN} are sent back to the ground" style="width:100%;height:auto;display:block;font-family:inherit">
    <defs>
      <linearGradient id="ghg-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f0d2f"/><stop offset=".2" stop-color="#3d2a63"/><stop offset=".42" stop-color="#9fb8db"/><stop offset=".8" stop-color="#e4eef8"/></linearGradient>
      <radialGradient id="ghg-sun"><stop offset=".45" stop-color="#FFC56B"/><stop offset=".6" stop-color="#FAA542" stop-opacity=".55"/><stop offset="1" stop-color="#FAA542" stop-opacity="0"/></radialGradient>
      <linearGradient id="ghg-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC56B" stop-opacity=".85"/><stop offset="1" stop-color="#FAA542" stop-opacity=".45"/></linearGradient>
      <linearGradient id="ghg-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A5865C" stop-opacity="0"/><stop offset=".5" stop-color="#A5865C" stop-opacity="${l ? .55 : .22}"/><stop offset="1" stop-color="#A5865C" stop-opacity="0"/></linearGradient>
      <linearGradient id="ghg-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fa552"/><stop offset="1" stop-color="#3f7a34"/></linearGradient>
      <radialGradient id="ghg-hot" cx=".55" cy="0" r=".7"><stop offset="0" stop-color="#E13B26" stop-opacity=".7"/><stop offset="1" stop-color="#E13B26" stop-opacity="0"/></radialGradient>
      <marker id="ghg-ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M0 0L10 5L0 10z" fill="#E13B26"/></marker>
      <clipPath id="ghg-clip"><rect width="${W}" height="${H}" rx="10"/></clipPath>
    </defs>
    <style>#ghg .hp{fill:none;stroke:#E13B26;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}</style>
    <g clip-path="url(#ghg-clip)">
      <rect width="${W}" height="${H}" fill="url(#ghg-sky)"/>
      ${[[540, 18], [600, 44], [500, 52], [612, 12], [430, 30], [362, 14]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#fff" opacity=".7"/>`).join('')}
      <rect class="hl s3" x="0" y="${B0}" width="${W}" height="${B1 - B0}" fill="url(#ghg-band)"><title>Layer of greenhouse gases</title></rect>
      ${mol.join('')}
      <path class="hl s1" d="M49 51 L75 41 L201 ${G + 6} L141 ${G + 30}Z" fill="url(#ghg-beam)"><title>Sunlight passes through the gases and warms the ground</title></path>
      <g class="hl s1"><circle cx="62" cy="46" r="54" fill="url(#ghg-sun)"/><circle cx="62" cy="46" r="24" fill="#FFC56B"><title>The sun</title></circle></g>
      <path d="M0 ${G + 8} Q${W / 2} ${G - 16} ${W} ${G + 8} V${H} H0Z" fill="url(#ghg-land)"/>
      ${l ? `<path d="M0 ${G + 8} Q${W / 2} ${G - 16} ${W} ${G + 8} V${H} H0Z" fill="url(#ghg-hot)"/>` : ''}
      ${hum}
      ${cols.map(heat).join('')}
      ${badge(126, 196, 1)}${badge(cols[0] - 22, 286, 2)}${badge(cols[3] + 13, 140, 3)}
      ${label(512, 36, 'Space', '', '#fff')}
      ${label(512, 134, 'Greenhouse', 'gases in the air')}
      ${label(512, 266, 'Heat', 'rising from the ground')}
      <text x="${W / 2}" y="372" text-anchor="middle" font-size="14" font-weight="600" fill="#fff">${l ? 'Earth’s surface is warming' : 'Earth’s surface'}</text>
    </g>
  </svg>`;
}
/* ---------- LEARN: why the way we count emissions matters ---------- */
const CNT_NAMES = ['China', 'United States of America', 'European Union', 'India', 'Russia', 'Brazil', 'Indonesia', 'Japan', 'United Kingdom', 'Canada', 'Saudi Arabia', 'Australia', 'Nigeria'];
const CNT_SHORT = {'United States of America': 'United States', 'Russian Federation': 'Russia', 'European Union': 'EU (27)'};
function countingHtml(){
  return `<section class="band" id="counting"><div class="wrap">
    <div class="center"><h2 class="h-brand">Why the way we count emissions matters</h2>
    <p class="lede">Ask “who is responsible for climate change?” and the answer depends on how you count. Countries argue hard about this in climate talks, because it decides who should cut first and who should pay. Try the six ways of counting below: three time periods, each for the whole country or per person.</p></div>
    <div class="cnt-ctl"><div class="seg segs" id="cnt-when" role="group" aria-label="Which years to count"><button data-w="year" class="on"><b>This year</b></button><button data-w="1990"><b>Since 1990</b></button><button data-w="1850"><b>Since 1850</b></button></div>
    <div class="seg segs" id="cnt-how" role="group" aria-label="Total or per person"><button data-h="tot" class="on"><b>Whole country</b></button><button data-h="pp"><b>Per person</b></button></div></div>
    <div class="grid2 mt1 cnt-grid" style="align-items:start">
      <div class="card"><p id="cnt-unit" class="muted" style="margin:0 0 12px;font-size:14px"></p><div id="cnt-bars" class="cnt-bars" aria-live="polite"><div class="empty">Loading…</div></div></div>
      <div class="card cnt-why" id="cnt-why"></div>
    </div>
    <p class="muted" style="font-size:13px">Greenhouse gases including land use and deforestation, which is why Brazil and Indonesia rank high. “Per person” divides each year's emissions by that year's population; for totals since 1990 or 1850 those yearly amounts are added up. Sources: <a href="https://ourworldindata.org/co2-and-greenhouse-gas-emissions" target="_blank" rel="noopener">Our World in Data</a> (emissions from Jones et al., 2024; population), CC BY.</p>
  </div></section>`;
}
function wireCounting(){
  const box = $('#cnt-bars'); if (!box) return;
  const st = {w: 'year', h: 'tot'};
  Promise.all([loadEmis0(), loadPop()]).then(([E, P]) => {
    if (!E || !P || !$('#cnt-bars')) { box.innerHTML = '<div class="empty">The data did not load.</div>'; return; }
    const rows = CNT_NAMES.map(n => D.find(e => e.n === n && e.t === 'country')).filter(e => e && E.c[e.s] && P[e.s]).map(e => {
      const [y0, v] = E.c[e.s], Y = y0 + v.length - 1, [p0, pv] = P[e.s], popY = y => (pv[y - p0] || 0) * 1e3, sum = from => v.slice(Math.max(0, from - y0)).reduce((a, b) => a + (b || 0), 0);
      const ppSum = from => v.reduce((a, x, i) => { const yr = y0 + i, p = popY(yr); return yr >= from && p > 0 && x ? a + x * 1e6 / p : a; }, 0);
      return {e, name: CNT_SHORT[e.n] || e.n, Y, year: v[v.length - 1], s1990: sum(1990), s1850: sum(1850), pp1990: ppSum(1990), pp1850: ppSum(1850), pop: popY(Y)};
    });
    const val = r => { const t = st.w === 'year' ? r.year : st.w === '1990' ? r.s1990 : r.s1850; return st.h === 'tot' ? t : st.w === 'year' ? t * 1e6 / r.pop : st.w === '1990' ? r.pp1990 : r.pp1850; };
        const show = (r) => { const v = val(r); return st.h === 'tot' && st.w !== 'year' ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) : v >= 100 ? fmt(Math.round(v)) : v.toFixed(1); };
    box.innerHTML = rows.map(r => `<div class="cnt-row" data-k="${r.e.s}"><span class="cnt-n">${r.e.a2 ? flag(r.e.a2) + ' ' : ''}${esc(r.name)}</span><span class="cnt-b"><i></i></span><span class="cnt-v"></span></div>`).join('');
    const draw = () => {
      const srt = rows.slice().sort((a, b) => val(b) - val(a)), mx = val(srt[0]);
      srt.forEach((r, i) => { const el = box.querySelector(`[data-k="${r.e.s}"]`); el.style.transform = `translateY(${i * 34}px)`; el.querySelector('i').style.width = (val(r) / mx * 100).toFixed(1) + '%'; el.querySelector('.cnt-v').textContent = show(r); });
      $('#cnt-unit').textContent = st.h === 'pp' ? (st.w === 'year' ? 'Tonnes of CO₂e per person this year' : 'Tonnes of CO₂e per person: each year’s emissions divided by that year’s population, added up. This is what one resident would have emitted had they lived through the whole period') : (st.w === 'year' ? 'Million tonnes (Mt) of CO₂e emitted this year' : 'Billion tonnes (Gt) of CO₂e emitted over the period');
      box.style.height = rows.length * 34 + 'px';
      const t = srt.slice(0, 3).map(r => r.name), find = n => rows.find(r => r.e.n === n), us = find('United States of America'), ind = find('India'), cn = find('China');
      const k = st.w + st.h, ratio = (a, b) => a && b ? (val(a) / val(b)) : null;
      const W = {
        yeartot: `<h3>Who emits most today?</h3><p>Counting each country's emissions this year puts <b>${t[0]}</b> first, then ${t[1]} and ${t[2]}. This is the view behind “the biggest emitters must cut fastest”: what happens in these few countries decides most of the world's emissions over the next decade.</p>`,
        yearpp: `<h3>Who emits most per person?</h3><p>Divide by population and the order changes. The average person in the United States emits about <b>${ratio(us, ind) ? ratio(us, ind).toFixed(0) : 'several'} times</b> as much as the average person in India, and China's per-person figure is now above the EU's. Countries with low emissions per person, such as India and Nigeria, argue that fairness should be judged person by person: everyone should have a similar share of what the atmosphere can still absorb.</p>`,
        '1990tot': `<h3>Counting from 1990</h3><p>1990 is when the UN climate science panel (the IPCC) published its first report, so the risks were widely known from then on. It is also the base year of the Kyoto Protocol, and many developed countries prefer counting from here. On this view <b>${t[0]}</b> has emitted the most, because its emissions grew fastest after 1990.</p>`,
        '1850tot': `<h3>Counting since the Industrial Revolution</h3><p>Carbon dioxide stays in the air for centuries, so emissions from the 1800s are still warming the planet today. Counting from 1850 puts <b>${t[0]}</b> and ${t[1]} ahead. Many developing countries argue that those who emitted first and most should cut fastest and help pay for others to adapt. The UN climate convention (1992) calls this <i>common but differentiated responsibilities</i>.</p>`,
        '1990pp': `<h3>Since 1990, per person</h3><p>Adding up each year's emissions per person since 1990 combines both arguments. Rich countries with smaller populations, such as ${t[0]} and ${t[1]}, move to the top, while ${cn ? 'China' : 'large developing countries'} and India fall down the list.</p>`,
        '1850pp': `<h3>Since 1850, per person</h3><p>Adding up each year's emissions per person follows the average resident through time, so fast-growing countries are not flattered by today's larger population. This is still the view most favourable to poorer, more populous countries. Measured this way, the average person in ${t[0]} carries a historical share roughly <b>${ratio(srt[0], ind) ? ratio(srt[0], ind).toFixed(0) : 'many'} times</b> that of the average person in India.</p>`,
      };
      $('#cnt-why').innerHTML = W[k] + `<p class="muted" style="font-size:13.5px;margin-bottom:0">None of these is “the right one”: each answers a different question. Net zero targets are set against a country's own total emissions, but debates about fairness use all of them.</p>`;
    };
    $$('#cnt-when button').forEach(b => b.onclick = () => { st.w = b.dataset.w; $$('#cnt-when button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    $$('#cnt-how button').forEach(b => b.onclick = () => { st.h = b.dataset.h; $$('#cnt-how button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    draw();
  });
}

/* ---------- LEARN: why companies and governments, not individuals (with a game) ---------- */
// well-known companies with a reported figure, smallest to largest; [name in the data, name shown]
const RIVALS = [['Starbucks', 'Starbucks'], ['Nike', 'Nike'], ['Coca-Cola Company', 'Coca-Cola'], ['Microsoft', 'Microsoft'], ['Toyota Motor', 'Toyota'], ['Walmart', 'Walmart'], ['American Airlines', 'American Airlines'], ['BP', 'BP'], ['Shell plc', 'Shell'], ['Chevron', 'Chevron'], ['Exxon Mobil', 'ExxonMobil']];
const WORLD_PC = 6.7;  // 54.4 Gt in 2024 over 8.16 billion people (Our World in Data)
function peopleHtml(){
  return `<section id="people"><div class="wrap">
    <div class="center"><h2 class="h-brand">Institutional action &gt; individual action</h2>
    <p class="lede">One person's choices change a few tonnes of emissions a year, while one government's rules or one company's plans can change millions of tonnes. That is why the biggest lever on climate change is what institutions decide, and why the Tracker holds governments and companies to their promises.</p></div>
    <div class="grid3 mt1">
      <div class="card"><h3>Most emissions are decided upstream</h3><p>Which power stations get built, how homes are heated, what cars are sold and how steel and cement are made are decided by governments and companies. Your choices happen inside the options they create.</p></div>
      <div class="card"><h3>The scale is very different</h3><p>ExxonMobil alone reported about <b>103 million tonnes</b> from its own operations in 2022, before counting the fuel it sells. The average person emits about ${WORLD_PC} tonnes a year.</p></div>
      <div class="card"><h3>The “carbon footprint” was an advert</h3><p>The idea of a personal carbon footprint was popularised in the mid-2000s by an advertising campaign from the oil company BP. Personal choices still count most when they push institutions: voting, organising, and where you work or bank.</p></div>
    </div>
    ${gameHtml()}
  </div></section>`;
}
/* "You vs. the giants": a life lived decade by decade, with real choices. Rough, rounded factors; documented in the footnote. */
// country: [flag, name, city, grid gCO2/kWh (Our World in Data / Ember, 2024-25), heating kWh per m2 a year, cooling kWh per m2 a year with air conditioning]
const LC = {
  US:['us','United States','Chicago',384,90,25], CA:['ca','Canada','Toronto',191,160,5], GB:['gb','United Kingdom','Manchester',217,120,2],
  DE:['de','Germany','Berlin',330,120,3], FR:['fr','France','Lyon',41,100,5], PL:['pl','Poland','Kraków',589,140,3],
  SE:['se','Sweden','Stockholm',35,130,1], NO:['no','Norway','Oslo',28,140,1], ES:['es','Spain','Madrid',154,45,20], IT:['it','Italy','Milan',285,70,15],
  CN:['cn','China','Shanghai',525,60,20], IN:['in','India','Delhi',670,0,45], JP:['jp','Japan','Osaka',477,60,20], KR:['kr','South Korea','Seoul',417,90,20],
  AU:['au','Australia','Melbourne',525,25,20], BR:['br','Brazil','São Paulo',110,0,35], NG:['ng','Nigeria','Lagos',456,0,45], ZA:['za','South Africa','Johannesburg',699,20,10],
  SA:['sa','Saudi Arabia','Riyadh',692,0,80], MX:['mx','Mexico','Monterrey',474,5,30], ID:['id','Indonesia','Jakarta',680,0,50], KE:['ke','Kenya','Nairobi',95,5,10],
};
const KGKM = {walk:0, transit:0.05, moto:0.10, petrol:0.17, hybrid:0.11, suv:0.25};
const HEATF = {gas:0.20, oil:0.29, district:0.15};
const STAGES = [[18, 25], [25, 35], [35, 50], [50, 65], [65, 81]];
function lifeAnnual(s){
  const C = LC[s.cty], grid = C[3] / 1000, br = {};
  const heatKwh = C[4] * s.area * (s.ins ? 0.65 : 1), hf = s.heat === 'hp' ? grid / 3 : s.heat === 'elec' ? grid : HEATF[s.heat] || 0.2;
  let elec = 1200 + 25 * s.area + (s.ac ? C[5] * s.area : 0) + (s.pool ? 3500 : 0); if (s.solar) elec *= 0.5;
  br.Home = (heatKwh * hf + elec * grid) / s.hh / 1000;
  const carF = s.car === 'ev' ? 0.18 * grid : KGKM[s.car] || 0, comF = s.commuteMode === 'car' ? carF : KGKM[s.commuteMode] || 0;
  br['Getting around'] = (s.commute * 2 * 230 * comF + (s.car && s.car !== 'none' ? 6000 * carF + (s.car2 ? 8000 * KGKM.petrol : 0) : 3000 * KGKM.transit)) / 1000;
  br.Flights = (s.fShort * 0.25 + s.fLong * 1.8) * (s.biz ? 3 : 1) + s.cruise * 1.5;
  br.Food = s.diet; br.Shopping = s.stuff; br['AI use'] = s.ai || 0; br['Shared services'] = 1.0;
  return br;
}
const sumBr = br => Object.values(br).reduce((a, b) => a + b, 0);
function lifeSteps(){
  const mv = (k, txt) => ({t: `${LC[k][2]}, ${LC[k][1]}`, k});
  return [
    {age: 0, title: 'You are born!', text: s => 'Where are you born? Your country decides how clean the electricity is and how much heating or cooling a home needs.', grid: true,
      opts: s => Object.keys(LC).map(k => ({t: `${flag(LC[k][0])} ${LC[k][1]}`, f: s => { s.cty = s.born = k; return `👶 You were born in ${LC[k][2]}, ${LC[k][1]}.`; }}))},
    {age: 18, title: 'Leaving home', text: s => `You're 18. Where in ${LC[s.cty][1]} do you live?`,
      opts: () => [['City centre', 'city'], ['Suburbs', 'sub'], ['Small town or countryside', 'rural']].map(([t, w]) => ({t, f: s => { s.where = w; return `🏙️ You moved to ${w === 'city' ? 'the centre of ' + LC[s.cty][2] : w === 'sub' ? 'the suburbs of ' + LC[s.cty][2] : 'a small town'}.`; }}))},
    {age: 18, title: 'Your first place', text: () => 'Where do you live while you study or start work?',
      opts: () => [['A room in a shared flat (60 m², 4 people)', 60, 4], ['A studio flat on your own (30 m²)', 30, 1], ['Stay with your parents (140 m² house, 4 people)', 140, 4]].map(([t, a, h]) => ({t, f: s => { Object.assign(s, {area: a, hh: h}); return `🏠 ${t}.`; }}))},
    {age: 18, title: 'Getting around', text: s => s.where === 'rural' ? 'The bus comes twice a day. How do you get around?' : 'How do you get around?',
      opts: s => [['Walk and cycle', 'walk', 4], ['Bus, metro or train', 'transit', 12], ['A second-hand petrol car', 'car', 15], ['A motorbike', 'moto', 12]].filter(o => !(s.where === 'rural' && o[1] === 'walk')).map(([t, m, d]) => ({t, f: s => { s.commuteMode = m; s.commute = d; s.car = m === 'car' ? 'petrol' : 'none'; return `🚲 ${t}.`; }}))},
    {age: 18, title: 'What do you eat?', text: () => 'Pick the diet you mostly stick to.',
      opts: () => [['Vegan', 1.0], ['Vegetarian', 1.4], ['Some meat', 2.0], ['Meat with every meal', 3.0]].map(([t, v]) => ({t, f: s => { s.diet = v; return `🍽️ Diet: ${t.toLowerCase()}.`; }}))},
    {age: 18, title: 'Holidays', text: () => 'How do you spend your holidays?',
      opts: () => [['Trains and road trips, no flights', 0, 0], ['One short flight a year', 1, 0], ['One long-haul trip a year', 0, 1], ['Party years: 4 short flights and 1 long-haul a year', 4, 1]].map(([t, a, b]) => ({t, f: s => { s.fShort = a; s.fLong = b; return `✈️ ${t}.`; }})), end: true},
    {age: 25, title: 'Job offer abroad!', text: s => { const ks = Object.keys(LC).filter(k => k !== s.cty); s.offer = ks[Math.floor(Math.random() * ks.length)]; return `A company in ${LC[s.offer][2]}, ${LC[s.offer][1]} wants to hire you.`; },
      opts: s => [{t: `Take it and move to ${LC[s.offer][2]}`, f: s => { s.cty = s.offer; return `🧳 You moved to ${LC[s.cty][2]}, ${LC[s.cty][1]}.`; }}, {t: 'Stay where you are', f: () => '🙅 You turned down the job abroad.'}]},
    {age: 25, title: 'A place of your own', text: s => `You're 25 and living in ${LC[s.cty][2]}. Where do you live?`,
      opts: () => [['Rent a one-bedroom flat (50 m²)', 50, 1], ['Share a house with three friends (120 m²)', 120, 4], ['Buy a small house on your own (100 m²)', 100, 1]].map(([t, a, h]) => ({t, f: s => { Object.assign(s, {area: a, hh: h}); return `🔑 ${t}.`; }}))},
    {age: 25, title: 'How is it heated?', when: s => LC[s.cty][4] >= 20, text: s => `Winters in ${LC[s.cty][2]} need heating. What does your home use?`,
      opts: () => [['Gas boiler', 'gas'], ['Electric heaters', 'elec'], ['Heat pump', 'hp'], ['Oil boiler', 'oil'], ['District heating', 'district']].map(([t, h]) => ({t, f: s => { s.heat = h; return `🔥 Heating: ${t.toLowerCase()}.`; }}))},
    {age: 25, title: 'Your commute', text: () => 'How far is work, and how do you get there?',
      opts: () => [['Work from home', 0, 'walk'], ['5 km by bike', 5, 'walk'], ['10 km by bus or train', 10, 'transit'], ['25 km by car each way', 25, 'car'], ['60 km by car each way', 60, 'car']].map(([t, d, m]) => ({t, f: s => { s.commute = d; s.commuteMode = m; return `🧭 Commute: ${t.toLowerCase()}.`; }}))},
    {age: 25, title: 'Your car', text: s => s.commuteMode === 'car' ? 'You drive to work. What do you drive?' : 'Do you own a car for weekends and errands?',
      opts: s => [['No car', 'none'], ['Electric car', 'ev'], ['Hybrid', 'hybrid'], ['Petrol hatchback', 'petrol'], ['Big SUV', 'suv']].filter(o => !(s.commuteMode === 'car' && o[1] === 'none')).map(([t, c]) => ({t, f: s => { s.car = c; return `🚗 ${c === 'none' ? 'No car.' : 'You drive ' + {ev: 'an electric car', hybrid: 'a hybrid', petrol: 'a petrol hatchback', suv: 'a big SUV'}[c] + '.'}`; }}))},
    {age: 25, title: 'Shopping', text: () => 'How do you shop for clothes, gadgets and stuff?',
      opts: () => [['Second-hand and repair', 0.8], ['Normal: buy what you need', 2.0], ['New phone every year, fast fashion, lots of deliveries', 4.5]].map(([t, v]) => ({t, f: s => { s.stuff = v; return `🛍️ ${t}.`; }}))},
    {age: 25, title: 'Using AI', text: () => 'How much do you use AI chatbots and generators?',
      opts: () => [['Never', 0], ['A few questions a day (10 prompts)', 3650 * 0.3], ['All day at work (100 prompts a day)', 36500 * 0.3], ['Creator mode: 100 prompts, 20 images and 2 short videos a day', 36500 * 0.3 + 7300 * 2.3 + 730 * 900]].map(([t, wh]) => ({t, f: s => { s.ai = wh / 1000 * 0.47 / 1000; return `🤖 AI: ${t.toLowerCase()}.`; }}))},
    {age: 25, title: 'Holidays in your twenties', text: () => 'How do you travel now?',
      opts: () => [['No flights', 0, 0], ['One long-haul trip a year', 0, 1], ['Six weekend city breaks by plane a year', 6, 0], ['City breaks and a long-haul trip', 6, 1]].map(([t, a, b]) => ({t, f: s => { s.fShort = a; s.fLong = b; return `✈️ ${t}.`; }})), end: true},
    {age: 35, title: 'Family', text: () => "You're 35. Who do you live with?",
      opts: () => [['On your own', 1], ['With a partner', 2], ['A partner and two kids', 4]].map(([t, h]) => ({t, f: s => { s.hh = h; return `👪 ${h === 4 ? 'You live with a partner and two kids' : h === 2 ? 'You live with a partner' : 'You live on your own'}.`; }}))},
    {age: 35, title: 'Buying a home', text: s => `You're buying a home in ${LC[s.cty][2]}.`,
      opts: () => [['2-bed flat (70 m²)', 70, 0], ['3-bed house (150 m²)', 150, 0], ['5-bed house (300 m²) with a heated pool', 300, 1]].map(([t, a, p]) => ({t, f: s => { s.area = a; s.pool = !!p; return `🏡 You bought a ${t.toLowerCase()}.`; }}))},
    {age: 35, title: 'Your boiler breaks!', when: s => LC[s.cty][4] >= 20 && (s.heat === 'gas' || s.heat === 'oil'), text: s => `The ${s.heat} boiler gives up in the middle of winter.`,
      opts: s => [{t: `Replace it with another ${s.heat} boiler`, f: () => '🔧 New boiler, same fuel.'}, {t: 'Switch to a heat pump', f: s => { s.heat = 'hp'; return '♨️ You switched to a heat pump.'; }}]},
    {age: 35, title: 'Heatwave!', text: s => `${LC[s.cty][2]} is having its hottest summer on record.`,
      opts: () => [{t: 'Install air conditioning', f: s => { s.ac = true; return '❄️ You installed air conditioning.'; }}, {t: 'Fans, blinds and cold showers', f: () => '🪭 You sweated it out.'}]},
    {age: 35, title: 'More cars?', text: () => 'With a bigger household, do you need another car?',
      opts: () => [{t: 'No, one is plenty (or none)', f: () => '🚗 Same car as before.'}, {t: 'Add a second petrol car', f: s => { s.car2 = true; if (s.car === 'none') s.car = 'petrol'; return '🚙 You added a second car.'; }}, {t: 'Swap to an electric car', f: s => { s.car = 'ev'; return '🔌 You switched to an electric car.'; }}]},
    {age: 35, title: 'Family holidays', text: () => 'Where do holidays go now?',
      opts: () => [['Camping by train or car', 0, 0], ['One short flight a year', 1, 0], ['One long-haul trip a year', 0, 1], ['Two long-haul trips a year', 0, 2]].map(([t, a, b]) => ({t, f: s => { s.fShort = a; s.fLong = b; return `🏖️ ${t}.`; }})), end: true},
    {age: 50, title: 'Time to renovate?', text: () => "You're 50 and the house needs work.",
      opts: () => [['Insulate walls and roof', 1, 0], ['Put solar panels on the roof', 0, 1], ['Both', 1, 1], ['Neither', 0, 0]].map(([t, i, p]) => ({t, f: s => { if (i) s.ins = true; if (p) s.solar = true; return `🛠️ Renovation: ${t.toLowerCase()}.`; }}))},
    {age: 50, title: 'Promotion!', text: () => 'You now lead a global team. They want you at meetings on three continents.',
      opts: () => [{t: 'Fly business class, 6 long-haul trips a year', f: s => { s.fLong += 6; s.biz = true; return '💼 You fly business class six times a year.'; }}, {t: 'Fly economy, 6 trips a year', f: s => { s.fLong += 6; return '🧳 You fly economy six times a year.'; }}, {t: 'Insist on video calls', f: () => '💻 You run the team by video call.'}], end: true},
    {age: 65, title: 'Retirement', text: () => "You're 65 and retired. Where do you live now?",
      opts: () => [{t: 'Downsize to a 60 m² flat', f: s => { s.area = 60; s.pool = false; s.hh = Math.min(s.hh, 2); s.car2 = false; return '📦 You downsized to a small flat.'; }}, {t: 'Stay in the family home', f: s => { s.hh = Math.min(s.hh, 2); return '🏡 You stayed in the family home.'; }}, {t: 'Retire somewhere sunny in Spain', f: s => { s.cty = 'ES'; s.hh = Math.min(s.hh, 2); return '🌞 You retired to Madrid.'; }}]},
    {age: 65, title: 'Retirement travel', text: () => 'Time to see the world?',
      opts: () => [['Stay close to home', 0, 0, 0], ['One cruise a year', 0, 0, 1], ['A long-haul trip every winter', 0, 1, 0], ['A cruise and a long-haul trip every year', 0, 1, 1]].map(([t, a, b, c]) => ({t, f: s => { s.fShort = a; s.fLong = b; s.biz = false; s.cruise = c; return `🛳️ ${t}.`; }})), end: true},
  ];
}
function gameHtml(){
  return `<div class="game mt2" id="game">
      <div class="game-hd"><span class="game-tag">🎮 Mini game</span><h3>You vs. the giants</h3><p>Live a whole life, one decision at a time, then see how it compares with one year of a big company.</p></div>
      <div class="game-body">
        <div class="life">
          <div class="life-top"><span id="lg-age">Age 0</span><span id="lg-where">–</span><span id="lg-rate">–</span></div>
          <div class="life-card" id="lg-card"></div>
          <div class="life-feed" id="lg-feed" aria-live="polite"></div>
        </div>
        <div class="game-out">
          <div class="score"><span>Your lifetime so far</span><b id="lg-total">0 t</b><small id="lg-avg"></small></div>
          <div class="gl" style="margin-top:12px">Your rival</div><div class="gopts rivals" id="g-rivals"></div>
          <div class="g-msg" id="g-msg" aria-live="polite"></div>
          <div class="track"><div class="lane"><span>Your life</span><span class="lbar"><i id="g-bar-you"></i><em id="g-pct"></em></span></div><div class="lane rival"><span id="g-rname">Rival</span><span class="lbar"><i style="width:100%"></i></span></div></div>
                    <button class="lg-restart" id="lg-restart">↺ Start a new life</button>
        </div>
      </div>
      <p class="muted game-src">Rough, rounded figures in tonnes of CO₂ equivalent for one person's consumption. Home energy uses each country's electricity carbon intensity (<a href="https://ourworldindata.org/grapher/carbon-intensity-electricity" target="_blank" rel="noopener" style="color:#fff">Our World in Data, from Ember</a>, 2024–25) and typical heating and cooling needs; a shared home is split between the people in it. Flights: about 0.25 t for a short return trip and 1.8 t for a long-haul one, tripled in business class; a week's cruise about 1.5 t. AI: about 0.3 Wh per text prompt (Google reported 0.24 Wh for a median Gemini prompt in 2025; OpenAI cited 0.34 Wh for ChatGPT), about 2.3 Wh per image and 0.9 kWh per 5-second video (MIT Technology Review estimates, 2025), at the world-average 470 g CO₂ per kWh. Food, shopping and shared public services use typical averages. Company figures are each company's latest reported Scope 1 and 2 emissions (via Wikirate), so they leave out supply chains and the products they sell.</p>
    </div>`;
}
function wireGame(){
  const g = $('#game'); if (!g) return;
  const STEPS = lifeSteps();
  let s, i, rival = 0, rivals = [];
  const nice = n => n >= 1e9 ? (n / 1e9).toFixed(1) + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' million' : n >= 100 ? fmt(Math.round(n)) : n >= 10 ? n.toFixed(0) : n.toFixed(1);
  const dur = x => x < 1 ? 'under a second' : x < 90 ? Math.round(x) + ' seconds' : x < 5400 ? Math.round(x / 60) + ' minutes' : x < 172800 ? (x / 3600).toFixed(1) + ' hours' : (x / 86400).toFixed(1) + ' days';
  const feed = (html, cls = '') => { const f = $('#lg-feed'); f.insertAdjacentHTML('afterbegin', `<div class="lf ${cls}">${html}</div>`); };
  const reset = () => { s = {cty: 'US', where: 'city', area: 60, hh: 4, heat: 'gas', commute: 10, commuteMode: 'transit', car: 'none', car2: false, diet: 2, stuff: 2, fShort: 0, fLong: 0, biz: false, cruise: 0, ins: false, solar: false, ac: false, pool: false, total: 0, age: 0}; i = 0; $('#lg-feed').innerHTML = ''; show(); };
  const ageUp = to => {
    const st = STAGES.find(([a]) => a === s.age) || [s.age, to], yrs = to - s.age, br = lifeAnnual(s), yr = sumBr(br);
    s.total += yr * yrs;
    feed(`🎂 <b>Age ${s.age}–${to - 1}:</b> ${yr.toFixed(1)} t a year × ${yrs} years = <b>${nice(yr * yrs)} t</b><br><small>${Object.entries(br).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ')}</small>`, 'big');
    s.age = to;
  };
  const show = () => {
    while (i < STEPS.length && STEPS[i].when && !STEPS[i].when(s)) { if (STEPS[i].end) ageUp(STAGES.find(([a]) => a === s.age)[1]); i++; }
    const R = rivals[rival];
    $('#lg-age').textContent = `Age ${Math.min(s.age, 80)}`; $('#lg-where').textContent = s.cty && i > 0 ? `${LC[s.cty][2]}, ${LC[s.cty][1]}` : 'Not born yet';
    $('#lg-rate').textContent = i > 1 ? `${sumBr(lifeAnnual(s)).toFixed(1)} t a year` : '';
    $('#lg-total').textContent = nice(s.total) + ' t'; $('#lg-avg').textContent = s.age > 18 ? `${(s.total / ((s.age - 18) * WORLD_PC)).toFixed(1)}× the world average for those years` : '';
    if (R) {
      $('#g-rname').textContent = R.name;
      const share = s.total / R.t * 100; $('#g-bar-you').style.width = Math.min(100, share) + '%';
      $('#g-pct').textContent = s.total ? share.toFixed(Math.min(12, Math.max(2, 1 - Math.floor(Math.log10(share))))) + `% of one year of ${R.name}` : '';
      $('#g-msg').innerHTML = s.total ? `${R.name} emits your lifetime so far in <b>${dur(s.total / R.t * 31557600)}</b>.` : `Pick choices on the left. ${R.name} emits ${nice(R.t)} t a year.`;
    }
    const card = $('#lg-card');
    if (i >= STEPS.length) {
      const yrs = R ? R.t / s.total : 0;
      card.innerHTML = `<div class="lc-age">Age 80</div><h4>🪦 Rest in peace</h4><p>You lived to 80${s.cty !== s.born ? `, from ${LC[s.born][2]} to ${LC[s.cty][2]}` : ` in ${LC[s.cty][2]}`}, and emitted <b>${nice(s.total)} t</b> of CO₂ equivalent in your adult life.</p>${R ? `<p><b>${R.name}</b> emits that in <b>${dur(s.total / R.t * 31557600)}</b>. To match just one of its years, <b>${nice(yrs)} people</b> would have to live your exact life.</p>` : ''}<p class="muted" style="font-size:13px">Your choices still matter, mostly by changing what governments and companies do: how you vote, where you work and bank, what you push for.</p>`;
      feed(`🪦 You died peacefully at 80. Lifetime: <b>${nice(s.total)} t</b>.`, 'big');
      return;
    }
    const st = STEPS[i];
    card.innerHTML = `<div class="lc-age">Age ${st.age}</div><h4>${st.title}</h4><p>${st.text(s)}</p><div class="lc-opts ${st.grid ? 'grid' : ''}">${st.opts(s).map((o, j) => `<button data-j="${j}">${o.t}</button>`).join('')}</div>`;
    const opts = st.opts(s);
    $$('#lg-card [data-j]').forEach(b => b.onclick = () => {
      const line = opts[+b.dataset.j].f(s); if (line) feed(line);
      if (st.age > s.age) s.age = st.age;
      if (st.end) ageUp(STAGES.find(([a]) => a === s.age)[1]);
      i++; show();
    });
  };
  loadComp().then(K => {
    const d = (K && K.d) || {}, latest = o => { for (let k = o.v.length - 1; k >= 0; k--) if (o.v[k] != null) return o.v[k]; return 0; };
    rivals = RIVALS.map(([nm, show]) => { const e = D.find(x => x.n === nm && x.t === 'company'); const o = e && d[e.s]; return o ? {name: show, t: latest(o) * 1e6} : null; }).filter(Boolean);
    rival = rivals.length - 1;  // start against the biggest
    $('#g-rivals').innerHTML = rivals.map((r, k) => `<button data-r="${k}" class="${k === rival ? 'on' : ''}">${esc(r.name)}</button>`).join('');
    $$('#g-rivals button').forEach(b => b.onclick = () => { rival = +b.dataset.r; $$('#g-rivals button').forEach(x => x.classList.toggle('on', x === b)); show(); });
    show();
  });
  $('#lg-restart').onclick = reset;
  reset();
}

P.learn = (params, sub) => `
  <section class="hero" style="padding:48px 0"><div class="wrap"><p class="eyebrow" style="color:#ffb3a8">Net zero explained</p><h1 style="font-size:clamp(30px,4.5vw,46px)">What net zero means, and how to tell a real target from a slogan</h1><p>A 2-minute primer, a glossary, and how we assess every target.</p></div></section>
  <section id="why"><div class="wrap">
    <div class="center"><h2 class="h-brand">Why net zero matters for the climate</h2><p class="lede">Heat-trapping gases build up in the air. To stop the planet warming, the amount we add has to fall to zero, not just fall.</p></div>
    <div class="grid3 mt2">
      <div class="card" style="border-top:5px solid var(--brown)"><h3>Carbon piles up</h3><p>Carbon dioxide stays in the air for centuries. Each year’s emissions are added to what is already there, a bit like a bathtub filling faster than it drains.</p></div>
      <div class="card" style="border-top:5px solid var(--red)"><h3>Warming only stops at zero</h3><p>Cutting emissions slows the warming, but does not stop it. The temperature stops climbing only when the carbon dioxide we add is balanced by what is taken out. That is what “net zero” means.</p></div>
      <div class="card" style="border-top:5px solid var(--green)"><h3>Targets turn that into action</h3><p>Governments, regions, cities and companies set net zero targets to say when, and how, they will get there. The Tracker checks whether each promise holds up.</p></div>
    </div>
    <div class="grid2 mt2" style="align-items:center">
      <div><h3 style="font-size:22px">The greenhouse effect, in three steps</h3>
        <ol class="asks ghg-steps" id="ghgsteps"><li data-step="1" tabindex="0">Sunlight reaches the Earth and warms the ground.<small>About half of the sun’s energy that reaches Earth is absorbed at the surface.</small></li>
        <li data-step="2" tabindex="0">The warm ground sends heat back up.<small>Some of it escapes to space.</small></li>
        <li data-step="3" tabindex="0">Greenhouse gases catch some of that heat and send it back down.<small>This keeps the planet livable. But the more gases we add, the more heat is sent back, and the warmer it gets.</small></li></ol>
      </div>
      <figure class="card ghg-fig"><div class="ghg-top"><div class="ghg-tog" id="ghgseg" role="tablist" aria-label="Amount of greenhouse gas"><button data-l="0" class="on" role="tab" aria-selected="true">Before: fewer gases</button><button data-l="1" role="tab" aria-selected="false">Now: more gases</button></div></div><p class="ghg-lede" id="ghg-lede">${GHG_LEDE[0]}</p>
        <div id="ghg">${ghgSvg(0)}</div><figcaption id="ghg-cap">${GHG_CAP[0]}</figcaption></figure>
    </div>
    <div class="card mt2" style="background:var(--band)"><h3>The global goal: the Paris Agreement</h3>
      <p>In 2015, nearly every country agreed in Paris to keep global warming <b>well below 2°C</b> above pre-industrial levels, and to try to keep it to <b>1.5°C</b>. The world has already warmed by more than 1°C.</p>
      <ul class="flags plain"><li>To have a good chance of staying at 1.5°C, the UN climate science panel (the IPCC) found that global carbon dioxide emissions need to fall by roughly <b>45% by 2030</b> (from 2010 levels) and reach <b>net zero around 2050</b>.</li>
      <li>For 2°C, net zero is needed around <b>2070</b>.</li>
      <li>Each country sets its own national plan under the agreement and has to update it every five years. Many have added net zero dates, and so have many cities and companies.</li></ul>
      <p class="muted" style="font-size:14px;margin-bottom:0">Figures are from the IPCC’s 2018 special report on 1.5°C.</p></div>
  </div></section>
  <section><div class="wrap grid2" style="align-items:center">
    <div><h2 class="h-brand">Net zero in one picture</h2>
    <p class="lede">Emissions are the heat-trapping gases, mostly carbon dioxide, released when we burn coal, oil and gas. <b>Net zero</b> means cutting them as far as we can, then taking the small amount left back out of the air.</p><p>It doesn’t necessarily mean releasing nothing. It means roughly 90% or more is cut first.</p>
    <p>Offsetting a large share instead of cutting is not net zero. Planting trees today while emissions keep rising is not net zero either.</p></div>
    <div class="card">${netZeroDiagram()}</div>
  </div></section>
  <section class="band" id="method"><div class="wrap">
    <div class="center"><h2 class="h-brand">How we assess targets</h2><p class="lede">Every profile answers 4 questions using the indicators our researchers record. Each check is marked yes, partly, no or unknown.</p></div>
    <div class="checks mt2">${PILLARS.map(p => { const sample = checks({t:'country',e:'Net zero'}).concat(checks({t:'company',e:'Net zero'})).filter((c,i,a) => c.p === p.id && a.findIndex(x => x.id === c.id) === i);
      return `<div class="card" style="--p:${p.col}"><h3><i></i>${p.name}</h3>${sample.map(c => `<div class="item"><div><div class="q">${c.q}${c.id==='s3'?' <span class="badge company">Companies</span>':c.id==='cons'||c.id==='acc'?' <span class="badge country">Governments</span>':''}</div><div class="a">${esc(c.why)}</div></div></div>`).join('')}</div>`; }).join('')}</div>
    <div class="note mt2"><b>About this summary.</b> These checks restate indicators that the Net Zero Tracker already records, such as status, interim targets, gases, Scope 3, plan elements, reporting, accountability, offsets and removals. The "X of Y checks met" count is a prototype idea for the team to review, not an official rating. "Unknown" means the information was not public or not specified.</div>
  </div></section>
  <section><div class="wrap">
    <div class="center"><h2 class="h-brand">What the experts agree on</h2><p class="lede">We compared ${GN.inst.length - 1} leading initiatives and a review of 37 more, across ${gnRows().length} criteria, and broke down exactly what each one says.</p></div>
    <div class="grid3 mt2">
      <div class="card"><h3>Strongest agreement</h3><p class="muted mt0" style="font-size:15px">Very high agreement on the principle:</p><ul class="flags">${gnRows().filter(r => r.p === 'Very high').map(r => `<li>${esc(r.short)}</li>`).join('')}</ul></div>
      <div class="card"><h3>Agree on the “what”, not the “how”</h3><ul class="flags">${gnRows().filter(r => LVL[r.p] >= 3 && LVL[r.s] <= 1 && r.s !== 'N/A').map(r => `<li>${esc(r.short)}</li>`).join('')}</ul></div>
      <div class="card" style="border-top:5px solid var(--red)"><h3>See who says what</h3><p>Every criterion, every initiative, with quoted explanations and source pages.</p><a class="btn btn-purple btn-sm" href="#/goodnet">Open the full comparison →</a></div>
    </div>
  </div></section>
  <section id="offsets"><div class="wrap">
    <div class="center"><h2 class="h-brand">Offsets, removals and greenwashing</h2><p class="lede">Three different things often get blurred together. Telling them apart is the quickest way to spot a weak target.</p></div>
    <div class="grid3 mt2">
      <div class="card" style="border-top:5px solid var(--red)"><h3>Cuts</h3><p>Actually emitting less: efficiency, clean power, changed processes. This is the main job, and it is what “deep cuts first” means.</p></div>
      <div class="card" style="border-top:5px solid var(--green)"><h3>Removals</h3><p>Taking carbon out of the air and storing it, in forests and soils or with engineered methods. Needed only for the small leftover that cannot be cut.</p></div>
      <div class="card" style="border-top:5px solid var(--brown)"><h3>Offsets (credits)</h3><p>Paying someone else to cut or absorb emissions, then counting it against your own. Credits can fund cuts or removals, but they are a bookkeeping claim, not a cut at the source.</p></div>
    </div>
    <div class="grid2 mt2" style="align-items:start">
      <div class="card"><h3>Why offsets can be greenwashing</h3><ul class="flags plain">
        <li><b>Overstated benefit.</b> Many credits count emissions that would not have happened anyway, or measure against a baseline that flatters the project.</li>
        <li><b>Not permanent.</b> Carbon stored in trees can be released by fire, disease or logging. Emitting today and “absorbing” later is not an equal trade.</li>
        <li><b>Double counting.</b> The same reduction can be claimed by the seller, the buyer and a national government.</li>
        <li><b>A way to avoid cutting.</b> If offsets replace cuts, emissions keep rising while the headline says “neutral”.</li>
        <li><b>Vague labels.</b> “Carbon neutral” often means offsets for everything, not a plan to reach net zero.</li></ul></div>
      <div class="card"><h3>Why removals cannot carry the load today</h3>
        <p>Human activity emits about 40 billion tonnes of CO₂ a year from fossil fuels and industry. Engineered carbon removal today is a tiny fraction of one percent of that, and it is costly and energy hungry to scale. Forests help but can be undone, and the land they need is limited.</p>
        <p>So removals are credible for a small, well-explained leftover, not as a way to keep emitting at today’s level.</p></div>
    </div>
    <div class="grid2 mt2" style="align-items:start">
      <div class="card"><h3>What the experts say</h3><p>The UN Secretary-General’s High-Level Expert Group on net zero (2022) said credits should not be used in place of an organisation cutting its own emissions, and that any use should be disclosed openly. The Tracker records whether each target plans to use offsets and whether it sets quality conditions.</p><a href="https://www.un.org/en/climatechange/high-level-expert-group" target="_blank" rel="noopener">Read the expert group’s recommendations ↗</a></div>
      <div class="card"><h3>What the data shows</h3>${(() => { const co = D.filter(e => e.t === 'company'), y = co.filter(e => e.off === 'Yes').length, n = co.filter(e => e.off === 'No').length, u = co.filter(e => e.off === 'Not Specified').length; return `<p>Of ${fmt(co.length)} companies in the dataset, <b>${fmt(y)}</b> say they plan to use offsets, <b>${fmt(n)}</b> say they will not, and <b>${fmt(u)}</b> do not say. Among those that answer, <b>${pct(y, y + n)}%</b> plan to use them.</p><a class="btn btn-purple btn-sm" href="#/explore?type=company">Explore companies</a>`; })()}</div>
    </div>
    <div class="note mt2"><b>Questions to ask any target.</b> How much of it depends on offsets? Are the credits independently verified and permanent? Are cuts and removals reported separately? Does it say when its leftover emissions will be removed, and how?</div>
  </div></section>
  ${countingHtml()}
  ${peopleHtml()}
  <section class="band"><div class="wrap">
    <h2 class="h-brand">Glossary</h2><p class="lede mt0">Every technical term on this site, in one line, plus why it matters.</p>
    <div class="gloss mt2">${GLOSS.map(([t,d,w]) => `<details><summary>${t}</summary><p class="plain">${d}</p><p>${w}</p></details>`).join('')}</div>
  </div></section>`;
P.learn.after = (params, sub) => {
  wireCounting(); wireGame();
  (() => { const fig = $('#ghg'), lis = $$('#ghgsteps li'); if (!fig) return;
    const set = n => { if (n) fig.dataset.hl = n; else delete fig.dataset.hl; lis.forEach(l => l.classList.toggle('on', l.dataset.step === String(n))); };
    lis.forEach(l => { l.addEventListener('mouseenter', () => set(l.dataset.step)); l.addEventListener('focus', () => set(l.dataset.step)); l.addEventListener('mouseleave', () => set(null)); l.addEventListener('blur', () => set(null)); });
    fig.addEventListener('mouseover', ev => { const b = ev.target.closest('[data-step]'); if (b) set(b.dataset.step); });
    fig.addEventListener('mouseout', ev => { if (ev.target.closest('[data-step]')) set(null); }); })();
  $$('#ghgseg button').forEach(b => b.onclick = () => { const l = +b.dataset.l; $('#ghg').innerHTML = ghgSvg(l); $('#ghg-cap').innerHTML = GHG_CAP[l]; $('#ghg-lede').textContent = GHG_LEDE[l]; $$('#ghgseg button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); }); nzdWire(); if (sub === 'method' || sub === 'offsets' || sub === 'counting' || sub === 'people') setTimeout(() => $('#' + sub)?.scrollIntoView(), 30); };
const NZD = {
  today:['1. Today: the pollution','Think of emissions as smoke going up into the air. Each cloud is 10% of a year’s emissions. They come from power plants and factories, petrol and diesel cars, heating homes, and even cows, which release methane. They all trap heat.','10 of 10 units released','Each cloud represents 10% of annual emissions, and all ten are still entering the atmosphere.'],
  cut:['2. Cut it at the source','Stop making the smoke in the first place: sun and wind instead of coal, electric cars, efficient homes, less methane from farming. Net zero standards ask for roughly 90% of emissions to be cut. One cloud is left.','1 of 10 units remaining','Nine units are eliminated at the source. One residual unit remains.'],
  remove:['3. Take out what is left','A small amount is very hard to avoid, such as from making cement or from farming. Take that carbon back out of the air, with trees and soils or machines that capture it and store it underground, and no extra carbon is added in total. That is net zero.','Net zero','The residual unit is removed from the atmosphere and stored durably, so net emissions are zero.'],
  offset:['Not the same: cutting less, then buying offsets','Cut only half, then pay for carbon credits to “cover” the rest. The money funds trees or other projects somewhere else, but your own smoke still goes up. Credits vary in quality, so experts warn they should not replace deep cuts.','5 of 10 units still released','Half the units are eliminated. The rest are offset on paper but still enter the atmosphere.']
};
const NZK = {
  smoke:['Greenhouse gases','Measured by their warming effect, carbon dioxide (CO₂) makes up about 75% of global emissions, mostly from burning coal, oil and gas and from clearing forests. Methane (about 18%) comes from livestock, landfills and oil and gas leaks. Nitrous oxide (about 4%) comes mainly from fertilisers, and fluorinated gases (about 2%) from refrigeration and industry.'],
  cut:['Cut at the source','Never released, because the activity was cleaned up: clean power, electric transport, better buildings, less waste.'],
  cap:['Removed and stored','Carbon taken back out of the air and kept out, for example by trees and soils or by capturing it and storing it underground. Needed only for the small leftover.'],
  off:['Covered by a credit, still going up','A carbon credit pays someone else to cut or absorb emissions. It is a paper claim: your own smoke still goes up, and credits can be low quality or double counted.']
};
const NZS = {
  ch:['Power plants and factories: about 58% of global emissions','Generating electricity and heat produces about 34% of global greenhouse gas emissions. Industry, such as steel, cement and chemicals, adds another 24%. Most of it comes from burning coal, oil and gas.'],
  car:['Transport: about 15% of global emissions','Cars, trucks, ships and planes run mostly on oil. Road vehicles produce roughly 70% of transport emissions.'],
  cow:['Farming and land use: about 22% of global emissions','This includes clearing forests and using fertiliser. Livestock alone, mainly methane from cattle digestion and manure, accounts for an estimated 12–15% of global emissions.'],
  house:['Buildings: about 6% of global emissions directly','Burning gas and oil for heating and cooking produces about 6%. Counting the electricity that buildings use raises the share to about 16%.']
};
const NZ_SRC_NOTE = ' <span class="nzd-note">Shares of 2019 global greenhouse gas emissions, from the IPCC Sixth Assessment Report (2022); livestock figure from the UN FAO.</span>';
NZK.src = ['A source of emissions','Power plants and factories burning fossil fuels, petrol and diesel cars, heating homes, and cows (which release methane) all send heat-trapping gases into the air.'];
NZK.clean = ['A clean replacement','Wind and solar power, electric cars and efficient homes do the same job without the smoke. This is how most of the cutting happens.'];
const NZM = ['today','cut','remove','offset'];
function nzdState(m, i){ return m === 'today' ? 'smoke' : m === 'cut' ? (i < 9 ? 'cut' : 'smoke') : m === 'remove' ? (i < 9 ? 'cut' : 'cap') : (i < 5 ? 'cut' : 'off'); }
const NZ_SLOT = {
  today:  {ch:['on','on','on'], car:['on','on','on'], cow:['on','on','on'], house:['on','on'], turb:0, forest:0},
  cut:    {ch:['on','ghost','ghost'], car:['on','ev','ev'], cow:['on','ghost','ghost'], house:['solar','solar'], turb:1, forest:0},
  remove: {ch:['on','ghost','cap'], car:['on','ev','ev'], cow:['on','tree','tree'], house:['solar','solar'], turb:1, forest:0},
  offset: {ch:['on','on','ghost'], car:['on','on','ev'], cow:['on','on','ghost'], house:['on','solar'], turb:0, forest:1}
};
const NZ_KIND = {on:'src', ghost:'cut', ev:'clean', solar:'clean', cap:'cap', tree:'cap'};
function nzdScene(){
  const F = {stroke:'#5EA845', dash:'4 3'};
  const slot = (id, x, vars) => `<g class="slot" id="sl-${id}" data-st="on" data-k="src" transform="translate(${x} 250)">${Object.entries(vars).map(([k, v]) => `<g class="v v-${k}">${v}</g>`).join('')}</g>`;
  const smoke = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#A5865C" opacity=".7"/><circle cx="${x + 4}" cy="${y - 10}" r="4" fill="#A5865C" opacity=".45"/>`;
  const chim = (c) => `<rect x="0" y="-62" width="18" height="40" fill="${c}"/><rect x="-2" y="-62" width="22" height="6" fill="#271039"/>`;
  const car = c => `<rect x="0" y="-14" width="38" height="10" rx="3" fill="${c}"/><path d="M8 -14 L13 -23 H27 L32 -14 Z" fill="${c}"/><circle cx="9" cy="-4" r="4" fill="#271039"/><circle cx="29" cy="-4" r="4" fill="#271039"/>`;
  const cow = (stroke, fill, extra = '') => `<g stroke="${stroke}" stroke-width="1.5" fill="${fill}"><rect x="5" y="-19" width="21" height="11" rx="5"/><rect x="-2" y="-21" width="9" height="8" rx="3"/><rect x="8" y="-9" width="3" height="9"/><rect x="21" y="-9" width="3" height="9"/></g>${extra}`;
  const tree = sc => `<g transform="scale(${sc})"><rect x="11" y="-14" width="5" height="14" fill="#8a6a3d"/><circle cx="13.5" cy="-26" r="13" fill="#3d7a2b"/><circle cx="6" cy="-19" r="9" fill="#4a8a3c"/><circle cx="21" cy="-19" r="9" fill="#4a8a3c"/></g>`;
  const house = roof => `<rect x="0" y="-20" width="34" height="20" fill="#e6d6bd"/><polygon points="-3,-20 17,-36 37,-20" fill="${roof}"/><rect x="12" y="-12" width="9" height="12" fill="#8a6a3d"/>`;
  let out = '';
  out += `<rect x="0" y="250" width="520" height="35" fill="#e9f2e3"/><rect x="14" y="228" width="98" height="22" fill="#3d1f5a" rx="2"/>`;
  [22, 52, 82].forEach((x, i) => out += slot('ch' + i, x, {on: chim('#5b3f7a') + smoke(9, -70), ghost: `<rect x="0" y="-62" width="18" height="40" fill="none" stroke="${F.stroke}" stroke-dasharray="${F.dash}" opacity=".6"/>`, cap: `<rect x="0" y="-48" width="18" height="26" rx="3" fill="#3B7CC3"/><rect x="-2" y="-52" width="22" height="5" rx="2" fill="#2a5f9c"/><circle cx="9" cy="-35" r="5" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M9 -62 v8 M5 -58 l4 4 l4 -4" stroke="#3B7CC3" stroke-width="2" fill="none"/>`}));
  [130, 172, 214].forEach((x, i) => out += slot('car' + i, x, {on: car('#5b3f7a') + smoke(-6, -9), ev: car('#5EA845') + '<polygon points="20,-13 15,-7 19,-7 17,-2 23,-9 19,-9" fill="#fff" transform="translate(0 1)"/>'}));
  [262, 297, 332].forEach((x, i) => out += slot('cow' + i, x, {on: cow('#271039', '#fff', '<circle cx="12" cy="-14" r="2.5" fill="#271039"/><circle cx="19" cy="-12" r="2" fill="#271039"/>' + smoke(30, -26)), ghost: cow('#5EA845', 'none').replace('stroke-width="1.5"', 'stroke-width="1.5" stroke-dasharray="3 2" opacity=".6"'), tree: tree(1)}));
  [372, 414].forEach((x, i) => out += slot('house' + i, x, {on: house('#8a6a3d') + `<rect x="24" y="-40" width="6" height="12" fill="#5b3f7a"/>` + smoke(27, -46), solar: house('#3B7CC3') + '<path d="M3 -22 L17 -33 L31 -22 M10 -27 L24 -27" stroke="#fff" stroke-width="1" fill="none"/>'}));
  out += `<g class="sl2 turb" id="sl-turb" data-k="clean" transform="translate(488 250)"><line x1="0" y1="0" x2="0" y2="-60" stroke="#7D7089" stroke-width="3"/><g transform="translate(0 -62)"><g class="blades"><line x1="-17" y1="0" x2="17" y2="0" stroke="#5EA845" stroke-width="3" stroke-linecap="round"/><line x1="0" y1="-17" x2="0" y2="17" stroke="#5EA845" stroke-width="3" stroke-linecap="round"/></g><circle r="3.5" fill="#271039"/></g></g>`;
  const P0 = [100, 172], P1 = [290, 140], P2 = [492, 212], q = t => [0, 1].map(i => ((1 - t) ** 2 * P0[i] + 2 * (1 - t) * t * P1[i] + t * t * P2[i]).toFixed(1));
  out += `<g class="sl2 forest" id="sl-forest" data-k="off"><path d="M${P0} Q${P1} ${P2}" fill="none" stroke="#FAA542" stroke-width="2.5" stroke-dasharray="6 5"/>${[.3, .55, .8].map(t => `<g transform="translate(${q(t)})"><circle r="9" fill="#FAA542" stroke="#fff" stroke-width="2"/><text y="4" text-anchor="middle" font-size="11" font-weight="800" fill="#271039">$</text></g>`).join('')}<text x="280" y="150" text-anchor="middle" font-size="11" font-weight="700" fill="#a8670a" paint-order="stroke" stroke="#f4f8fc" stroke-width="4">pays for credits</text><g transform="translate(468 250)">${tree(.8)}</g><g transform="translate(490 250)">${tree(.7)}</g><text x="518" y="268" text-anchor="end" font-size="10" fill="#5f5869">Someone else’s trees</text></g>`;
  out += `<g font-size="10.5" fill="#5f5869" text-anchor="middle"><text x="63" y="268">Power plants</text><text x="170" y="268">Cars</text><text x="297" y="268">Cows</text><text x="395" y="268">Homes</text></g>`;
  return out;
}
function netZeroDiagram(){
  const cloud = 'M-26 14 C-38 14 -38 -6 -22 -6 C-20 -22 4 -26 10 -12 C24 -20 38 -4 28 6 C40 8 38 14 28 14 Z';
  const puffs = Array.from({length: 10}, (_, i) => `<g class="pf s-smoke" data-k="smoke" data-i="${i}" transform="translate(${70 + (i % 5) * 95} ${i < 5 ? 52 : 112})" tabindex="0"><path d="${cloud}"/><g class="coin"><circle cx="22" cy="-18" r="12"/><text x="22" y="-13.5" text-anchor="middle">CR</text></g></g>`).join('');
  return `<div class="nzd" id="nzd">
  <div class="seg nzseg" id="nzseg" role="group" aria-label="Step">${NZM.map((m, i) => `<button data-m="${m}" class="${i ? '' : 'on'}"><b>${i < 3 ? i + 1 : '✗'}</b> ${['Today', 'Cut', 'Remove', 'Offsets only'][i]}</button>`).join('')}</div>
  <svg viewBox="0 0 520 285" id="nzsvg" role="img" aria-label="Ten pollution clouds, each one tenth of emissions, rising from power plants, cars, cows and homes, showing what is cut, removed or only offset">${puffs}${nzdScene()}</svg>
  <div class="nzd-legend" id="nzlegend"><span data-k="smoke"><i class="k-smoke"></i>Pollution going up</span><span data-k="cut"><i class="k-cut"></i>Cut at the source</span><span data-k="cap"><i class="k-cap"></i>Removed and stored</span><span data-k="off"><i class="k-off"></i>Credit, still going up</span></div>
  <h4 class="nzd-h" id="nzd-h"></h4><p class="nzd-p" id="nzd-p"></p>
  <div class="nzd-capw" id="nzd-capw"><div class="nzd-cap" id="nzd-cap" aria-live="polite"></div></div></div>`;
}
function nzdWire(){
  const root = $('#nzd'); if (!root) return;
  let m = 'today';
  const draw = (hl, sec) => {
    $$('#nzsvg .pf').forEach(g => { const k = nzdState(m, +g.dataset.i); g.setAttribute('class', `pf s-${k}${hl ? (hl === k ? ' hlon' : ' hloff') : ''}`); g.dataset.k = k; });
    const T = NZ_SLOT[m];
    $$('#nzsvg .slot').forEach(g => { const mm = g.id.match(/sl-([a-z]+)(\d)/), st = T[mm[1]][+mm[2]], k = NZ_KIND[st]; g.dataset.st = st; g.dataset.k = k; g.setAttribute('class', 'slot' + (hl ? (hl === k && (!sec || mm[1] === sec) ? ' hlon' : ' hloff') : '')); });
    [['turb', 'turb'], ['forest', 'forest']].forEach(([id, key]) => { const g = $('#sl-' + id); if (g) g.setAttribute('class', `sl2 ${id}${T[key] ? ' show' : ''}${hl ? (hl === g.dataset.k ? ' hlon' : ' hloff') : ''}`); });
    $$('#nzlegend span').forEach(sp => sp.classList.toggle('on', sp.dataset.k === hl));
    $('#nzd-h').textContent = NZD[m][0]; $('#nzd-p').textContent = NZD[m][1];
    const S = hl === 'src' && NZS[sec];
    $('#nzd-cap').innerHTML = S ? `<b>${esc(S[0])}.</b> ${esc(S[1])}${NZ_SRC_NOTE}` : hl ? `<b>${esc(NZK[hl][0])}.</b> ${esc(NZK[hl][1])}` : `<b>${esc(NZD[m][2])}.</b> ${esc(NZD[m][3])}`;
    $('#nzd-cap').classList.toggle('warn', m === 'offset'); $('#nzd-cap').classList.toggle('hov', !!hl);
  };
  // reserve the tallest caption/paragraph so the card never changes height (keeps the text on the left from jumping)
  const reserve = () => {
    const cap = $('#nzd-cap'), w = $('#nzd-capw'), p = $('#nzd-p'), h = $('#nzd-h'); if (!cap || !p) return;
    w.style.minHeight = p.style.minHeight = '0'; cap.classList.remove('hov');
    const cur = [cap.innerHTML, p.textContent, h.textContent]; let mc = 0, mp = 0;
    NZM.forEach(k => { p.textContent = NZD[k][1]; mp = Math.max(mp, p.offsetHeight); cap.innerHTML = `<b>${esc(NZD[k][2])}.</b> ${esc(NZD[k][3])}`; mc = Math.max(mc, cap.offsetHeight); });
    cap.innerHTML = cur[0]; p.textContent = cur[1]; h.textContent = cur[2];
    w.style.minHeight = mc + 'px'; p.style.minHeight = mp + 'px';   // hover captions float over the bottom of the card instead of resizing it
  };
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(reserve, 150); });
  $$('#nzseg button').forEach(b => b.onclick = () => { m = b.dataset.m; $$('#nzseg button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  const kind = ev => ev.target.closest('[data-k]')?.dataset.k || null;
  const sec = ev => ev.target.closest('.slot')?.id.match(/sl-([a-z]+)/)?.[1];
  root.addEventListener('mouseover', ev => draw(kind(ev), sec(ev)));
  root.addEventListener('mouseleave', () => draw());
  root.addEventListener('focusin', ev => draw(kind(ev), sec(ev)));
  root.addEventListener('focusout', () => draw());
  root.addEventListener('click', ev => { const k = kind(ev); if (k) draw(k, sec(ev)); });
  draw(); reserve(); draw();
}

/* ---------- POLICYMAKERS ---------- */
P.policymakers = () => {
  const strong = byType('country').filter(e => isNZ(e) && checks(e).every(c => c.v === 'yes' || (c.id === 'cons' && c.v !== 'no'))).slice(0, 12);
  const top = byType('country').filter(isNZ).map(e => [e, tally(checks(e)).yes]).sort((a,b) => b[1]-a[1] || a[0].n.localeCompare(b[0].n)).slice(0, 10);
  const G = gapStats('country');
  return `<section class="hero" style="padding:48px 0"><div class="wrap"><p class="eyebrow" style="color:#ffb3a8">For policymakers and officials</p><h1 style="font-size:clamp(30px,4.5vw,46px)">Benchmark your target, find its gaps, and learn from peers</h1><p>For national and local officials, legislators and their staff, and the people who brief them.</p></div></section>
  <section><div class="wrap grid2">
    <div><h2 class="h-brand">Start with your own profile</h2><p>Search for your country, state, province or city. Each profile gives you:</p>
      <div class="steps mt1">
        <div><h3>A plain-language verdict</h3><p>One paragraph you can reuse, with the target, its legal status and its main gaps.</p></div>
        <div><h3>A peer benchmark</h3><p>How your jurisdiction compares with others in your region or country, check by check.</p></div>
        <div><h3>A briefing paragraph</h3><p>Neutral, sourced wording you can copy into a memo or briefing note.</p></div>
      </div></div>
    <div class="card" style="align-self:start"><h3>Find your jurisdiction</h3><div class="light">${searchBox('s-pm','Country, region or city…')}</div>
      <h3 class="mt2" style="font-size:17px">Where governments fall short</h3>
      <p class="muted mt0" style="font-size:14.5px">Share of the ${G.n} countries with a net zero target that also…</p>
      <table class="gap-chart" style="width:100%">${[['law','have it in law'],['interim','have a milestone by 2035'],['plan','have a complete plan'],['rep','report every year'],['rem','separate cuts from removals']].map(([k,l]) => `<tr><td class="q" style="width:50%">${l}</td><td><div class="hb"><div class="tr"><i style="width:${G[k]}%"></i></div><span>${G[k]}%</span></div></td></tr>`).join('')}</table>
    </div>
  </div></section>
  <section class="band"><div class="wrap">
    <h2 class="h-brand">Learn from the strongest national targets</h2>
    <p class="lede mt0">Countries meeting the most credibility checks. Open a profile to see the law, the milestone and the source documents.</p>
    <div class="tablewrap mt2"><table class="list" style="min-width:600px"><thead><tr><th>Country</th><th>Target</th><th>How firm?</th><th>Next milestone</th><th>Checks met</th></tr></thead><tbody>
      ${top.map(([e,s]) => `<tr class="rowlink" data-href="#/e/${e.s}"><td><a class="nm" href="#/e/${e.s}">${flag(e.a2)} ${esc(e.n)}</a></td><td>${esc(targetPhrase(e))}</td><td>${pill(e)}</td><td>${e.it && e.it!=='No target' ? esc((e.ip?e.ip+'% cut':'Target') + (iyear(e)?' by '+iyear(e):'')) : '—'}</td><td><b>${s}</b> of ${checks(e).length}</td></tr>`).join('')}
    </tbody></table></div>
  </div></section>
  <section><div class="wrap">
    <h2 class="h-brand">A checklist for drafting or reviewing a target</h2>
    <p class="lede mt0">Drawn from where international guidance agrees most (UN Expert Group, ISO, Race to Zero and others).</p>
    <div class="grid2 mt2">
      <div class="steps">
        <div><h3>Put the end date in law</h3><p>Legislation outlasts governments and creates a duty that can be enforced.</p></div>
        <div><h3>Set milestones every 5 years</h3><p>Start with one for 2030 or 2035, with a clear base year and a percentage.</p></div>
        <div><h3>Cover every gas and sector</h3><p>Include methane, international aviation and shipping, and report consumption emissions.</p></div>
      </div>
      <div class="steps" style="counter-reset:s 3">
        <div><h3>Publish a costed plan</h3><p>Name the measures, the cuts each will deliver, how far they will be applied, and when they will be reviewed.</p></div>
        <div><h3>Report every year to an independent body</h3><p>For example a climate change committee that advises and checks progress.</p></div>
        <div><h3>Limit offsets and separate removals</h3><p>Set separate targets for cuts and for removals, with strict quality rules for any credits.</p></div>
      </div>
    </div>
    <p class="mt2"><a href="#/learn">Full glossary and expert consensus →</a> · <a href="#/compare">Compare jurisdictions →</a></p>
  </div></section>`;
};
P.policymakers.after = () => wireSearch('s-pm');

/* ---------- ACTIVISTS ---------- */
P.advocates = () => {
  const G = gapStats('company');
  const big = byType('company').filter(e => e.priv !== 'Yes' && e.rev).sort((a,b) => b.rev - a.rev).slice(0, 200);
  const noT = big.filter(e => !isNZ(e)).slice(0, 8);
  return `<section class="hero" style="padding:48px 0"><div class="wrap"><p class="eyebrow" style="color:#ffb3a8">For advocates and campaigners</p><h1 style="font-size:clamp(30px,4.5vw,46px)">Hold net zero promises to account</h1><p>Find a target, spot its weak points, and ask the questions that matter. All the data is sourced and free to cite.</p></div></section>
  <section><div class="wrap grid2">
    <div><h2 class="h-brand">Three steps</h2>
      <div class="steps mt1">
        <div><h3>Look it up</h3><p>Search for the company, city or government you're campaigning on.</p><div class="light mt1">${searchBox('s-act','Company, city, region or country…')}</div></div>
        <div><h3>Read the checklist</h3><p>Every red ✗ or "partly" is a gap you can press on. "Unknown" usually means they haven't said, which is worth asking about too.</p></div>
        <div><h3>Use the questions</h3><p>Each profile generates questions from its own gaps, for shareholder meetings, council sessions, interviews or letters.</p></div>
      </div></div>
    <div style="align-self:start;display:grid;gap:18px"><div class="card" style="border-top:5px solid var(--red)"><h3>Six warning signs of a weak pledge</h3>
      <ul class="flags">
        <li><b>Only a distant date.</b> "Net zero by 2050" with nothing before 2035.</li>
        <li><b>Just a press release.</b> Announced, but not in law or official strategy.</li>
        <li><b>Leaves out the big stuff.</b> No Scope 3, or CO₂ only.</li>
        <li><b>Offsets doing the work.</b> Credits allowed, with no quality limits.</li>
        <li><b>No plan, no reporting.</b> Nothing to check progress against.</li>
        <li><b>"Carbon neutral" today.</b> Usually means offsets, not cuts.</li>
      </ul>
      <p class="muted" style="font-size:14px;margin-bottom:0">Of the ${fmt(G.n)} companies with a net zero target, only <b>${G.interim}%</b> have a milestone by 2035 and only <b>${G.plan}%</b> have a complete plan.</p>
    </div>
    <div class="card" style="border-top:5px solid var(--green)"><h3>Action &gt; words</h3>
      <p class="mt0">A good pledge is only the start. What counts is whether it gets delivered, so after you check the target, check the follow-through.</p>
      <ul class="flags">
        <li><b>Are emissions actually falling?</b> Ask for the yearly figures, not just the end date.</li>
        <li><b>Is there money and a named owner?</b> Look for a budget, a deadline for each step and someone accountable.</li>
        <li><b>Is anyone checking?</b> Independent reviews and yearly reports show whether a promise is on track. This site checks the promise; pair it with data on delivery.</li>
      </ul>
    </div></div>
  </div></section>
  <section class="band"><div class="wrap">
    <h2 class="h-brand">Among the world's 200 largest public companies, no net zero target yet</h2>
    <p class="lede mt0">Ranked by annual revenue. Each profile lists the questions to put to them.</p>
    <div class="grid4 mt2">${noT.map(e => `<a class="card path" href="#/e/${e.s}" style="border-top-color:var(--red)"><span class="who">${esc(e.cn || '')}</span><h3 style="margin:.2em 0">${esc(e.n)}</h3><p class="muted" style="margin:0">${esc(e.sec || '')} · ${money(e.rev)} revenue</p><p style="margin:.5em 0 0">${esc(targetPhrase(e))}</p><span class="go mt1">See profile →</span></a>`).join('')}</div>
    <p class="mt2"><a href="#/explore?type=company&st=0">See all companies without a target →</a></p>
  </div></section>
  <section id="share"><div class="wrap">
    <h2 class="h-brand">Share it, or write to someone who can act</h2>
    <p class="lede mt0">Pick an entry and we draft a post, a picture card and an email to a policymaker from its own checklist. You can edit everything before you send. Nothing is sent from this site: each button opens X, Facebook, LinkedIn or your own email program with the text filled in.</p>
    <div class="light mt1" style="max-width:520px">${searchBox('s-share','Search a company, city, region or country…')}</div>
    <div id="sh-out" class="mt2"><p class="muted">Start by choosing an entry above.</p></div>
  </div></section>
  <section><div class="wrap grid2">
    <div><h2 class="h-brand">Using the data responsibly</h2>
      <p>Our researchers record what an organisation <b>says</b> in its official documents. We do not judge whether it is on track to deliver. For that, pair this data with emissions data and independent assessments, which are linked on each profile.</p>
      <p>"Unknown" is not the same as "no". Say "has not disclosed" rather than "does not have".</p>
      <p>Data changes. Use the date on each entry, and the "Request an update" link if something has changed.</p></div>
    <div><h2 class="h-brand">How to cite</h2>
      <div class="cite">Net Zero Tracker (${NOW}). Energy &amp; Climate Intelligence Unit, Data-Driven EnviroLab, NewClimate Institute, Oxford Net Zero. zerotracker.net</div>
      <p class="muted" style="font-size:14.5px">Each profile has a "Cite this entry" line and a "Copy briefing paragraph" button. To export a list, go to <a href="#/explore">Explore</a> and choose <b>Export CSV</b>.</p></div>
  </div></section>`;
};
function shareText(e, lang){
  const X = lang && lang !== 'en' && window.EMLS && window.EMLS[lang];
  if (X) { const cs = checks(e), t = tally(cs); const r = X.post(emlName(e, lang), isNZ(e) ? year(e) : '', t.yes, cs.length, isNZ(e)) + ' #NetZero #ClimateAction'; return lang === 'hi' ? devnum(r) : r; }
  const cs = checks(e), t = tally(cs), gaps = cs.filter(c => c.v === 'no').map(c => shortGap[c.id]).filter(Boolean);
  let x = isNZ(e) ? `${Nm(e)}: ${targetPhrase(e)}. It meets ${t.yes} of ${cs.length} Net Zero Tracker credibility checks${gaps.length ? `; gap: ${gaps[0]}` : ''}.` : `${Nm(e)} has no net zero target, according to the Net Zero Tracker.`;
  return x + ' #NetZero #ClimateAction';
}
/* ---------- EMAIL TRANSLATIONS ---------- */
const EML_LANGS = {en:'English', es:'Español', fr:'Français', pt:'Português', de:'Deutsch', it:'Italiano', ar:'العربية', zh:'中文 (简体)'};
const EML_ISO = {
  es:'ESP MEX COL ARG PER CHL VEN ECU BOL GTM CUB DOM HND PRY NIC SLV CRI PAN URY PRI GNQ',
  fr:'FRA SEN CIV MLI BFA NER TCD GIN BEN TGO COG COD CMR GAB MDG BDI HTI LUX MCO',
  pt:'BRA PRT AGO MOZ GNB CPV STP', de:'DEU AUT LIE', it:'ITA SMR',
  ar:'SAU ARE EGY IRQ SYR JOR KWT QAT BHR OMN YEM LBY TUN DZA MAR LBN SDN MRT PSE', zh:'CHN'
};
const emlLangOf = e => Object.keys(EML_ISO).find(l => EML_ISO[l].split(' ').includes(e.c)) || 'en';
const EML = {
es:{subj:n=>`Pregunta sobre el objetivo de cero emisiones netas de ${n}`,greet:'Estimado/a [nombre]:',
  intro:(n,y,k,t,h)=>`Le escribo en relación con los compromisos climáticos de ${n}. Según el Net Zero Tracker, ${n} ${h?`tiene un objetivo de cero emisiones netas${y?` para ${y}`:''} y cumple ${k} de ${t} comprobaciones de credibilidad`:'no tiene un objetivo de cero emisiones netas'}.`,
  grate:'Le agradecería que respondiera a las siguientes preguntas:',link:'La ficha completa está aquí:',thanks:'Gracias por su tiempo.',bye:'Atentamente,',you:'[Su nombre]',
  q:{commit:n=>`¿Se comprometerá ${n} a alcanzar las cero emisiones netas, y en qué año?`,cut2030:n=>`¿Cuánto reducirá ${n} para 2030?`,who:()=>'¿Quién en el gobierno es responsable de los objetivos climáticos, y cuándo se publicará un plan?',board:()=>'¿Qué miembro de la junta directiva es responsable de la estrategia climática?',lock_g:n=>`¿Incluirá ${n} su objetivo de cero emisiones netas en la ley?`,lock_c:()=>'¿Adoptará formalmente la junta el objetivo y vinculará a él la remuneración de los directivos?',interim:n=>`¿Cuánto habrá reducido ${n} para 2030 y 2035, respecto de qué año base?`,gas:()=>'¿Por qué el objetivo excluye el metano y otros gases distintos del CO₂?',s3:()=>'¿Cubrirá el objetivo las emisiones de los proveedores y del uso de sus productos por los clientes (alcance 3)?',cons:n=>`¿Informará ${n} de las emisiones causadas por los bienes que importa?`,plan:()=>'¿Dónde está el plan que muestra qué medidas logran qué reducciones, y para cuándo?',rep:n=>`¿Publicará ${n} su progreso cada año?`,acc:()=>'¿Quién es formalmente responsable si no se cumple el objetivo?',offsets:()=>'¿Qué parte del objetivo depende de compensaciones de carbono, y qué normas de calidad se aplican?',rem:n=>`¿Fijará ${n} objetivos separados para reducir emisiones y para eliminar carbono?`,track:n=>`¿Va ${n} por buen camino para cumplir su hito, y qué dice la revisión independiente?`}},
fr:{subj:n=>`Question sur l’objectif de neutralité carbone de ${n}`,greet:'Madame, Monsieur [nom],',
  intro:(n,y,k,t,h)=>`Je vous écris au sujet des engagements climatiques de ${n}. Selon le Net Zero Tracker, ${n} ${h?`a fixé un objectif de neutralité carbone${y?` pour ${y}`:''} et satisfait ${k} des ${t} contrôles de crédibilité`:'n’a pas d’objectif de neutralité carbone'}.`,
  grate:'Je vous serais reconnaissant(e) de bien vouloir répondre aux questions suivantes :',link:'La fiche complète est disponible ici :',thanks:'Je vous remercie de votre attention.',bye:'Cordialement,',you:'[Votre nom]',
  q:{commit:n=>`${n} s’engagera-t-il à atteindre la neutralité carbone, et à quelle date ?`,cut2030:n=>`Quelle réduction ${n} réalisera-t-il d’ici 2030 ?`,who:()=>'Qui, au sein du gouvernement, est responsable des objectifs climatiques, et quand un plan sera-t-il publié ?',board:()=>'Quel membre du conseil d’administration est responsable de la stratégie climatique ?',lock_g:n=>`${n} inscrira-t-il son objectif de neutralité carbone dans la loi ?`,lock_c:()=>'Le conseil adoptera-t-il formellement l’objectif et y liera-t-il la rémunération des dirigeants ?',interim:n=>`Quelle réduction ${n} aura-t-il réalisée d’ici 2030 et 2035, par rapport à quelle année de référence ?`,gas:()=>'Pourquoi l’objectif exclut-il le méthane et les autres gaz que le CO₂ ?',s3:()=>'L’objectif couvrira-t-il les émissions des fournisseurs et de l’utilisation des produits par les clients (scope 3) ?',cons:n=>`${n} déclarera-t-il les émissions liées aux biens qu’il importe ?`,plan:()=>'Où se trouve le plan indiquant quelles mesures permettent quelles réductions, et pour quand ?',rep:n=>`${n} publiera-t-il ses progrès chaque année ?`,acc:()=>'Qui est formellement responsable si l’objectif n’est pas atteint ?',offsets:()=>'Quelle part de l’objectif dépend de compensations carbone, et quelles règles de qualité s’appliquent ?',rem:n=>`${n} fixera-t-il des objectifs distincts pour réduire les émissions et pour retirer du carbone ?`,track:n=>`${n} est-il en bonne voie pour atteindre son jalon, et que dit l’évaluation indépendante ?`}},
pt:{subj:n=>`Pergunta sobre a meta de emissões líquidas zero de ${n}`,greet:'Prezado(a) [nome],',
  intro:(n,y,k,t,h)=>`Escrevo a respeito dos compromissos climáticos de ${n}. Segundo o Net Zero Tracker, ${n} ${h?`tem uma meta de emissões líquidas zero${y?` para ${y}`:''} e cumpre ${k} de ${t} verificações de credibilidade`:'não tem uma meta de emissões líquidas zero'}.`,
  grate:'Agradeceria se pudesse responder às seguintes perguntas:',link:'A ficha completa está aqui:',thanks:'Obrigado(a) pela atenção.',bye:'Atenciosamente,',you:'[Seu nome]',
  q:{commit:n=>`${n} se comprometerá a atingir emissões líquidas zero e em que ano?`,cut2030:n=>`Quanto ${n} vai reduzir até 2030?`,who:()=>'Quem no governo é responsável pelas metas climáticas e quando um plano será publicado?',board:()=>'Qual membro do conselho de administração é responsável pela estratégia climática?',lock_g:n=>`${n} vai transformar sua meta de emissões líquidas zero em lei?`,lock_c:()=>'O conselho adotará formalmente a meta e vinculará a ela a remuneração dos executivos?',interim:n=>`Quanto ${n} terá reduzido até 2030 e 2035, em relação a qual ano-base?`,gas:()=>'Por que a meta exclui o metano e outros gases além do CO₂?',s3:()=>'A meta cobrirá as emissões de fornecedores e do uso dos produtos pelos clientes (escopo 3)?',cons:n=>`${n} informará as emissões causadas pelos bens que importa?`,plan:()=>'Onde está o plano que mostra quais medidas geram quais reduções e até quando?',rep:n=>`${n} publicará o progresso todos os anos?`,acc:()=>'Quem é formalmente responsável se a meta não for cumprida?',offsets:()=>'Que parte da meta depende de compensações de carbono e quais regras de qualidade se aplicam?',rem:n=>`${n} definirá metas separadas para reduzir emissões e para remover carbono?`,track:n=>`${n} está no caminho certo para cumprir seu marco, e o que diz a revisão independente?`}},
de:{subj:n=>`Frage zum Netto-Null-Ziel von ${n}`,greet:'Sehr geehrte/r [Name],',
  intro:(n,y,k,t,h)=>`ich schreibe Ihnen zu den Klimazusagen von ${n}. Laut dem Net Zero Tracker ${h?`hat ${n} ein Netto-Null-Ziel${y?` bis ${y}`:''} und erfüllt ${k} von ${t} Glaubwürdigkeitsprüfungen`:`hat ${n} kein Netto-Null-Ziel`}.`,
  grate:'Ich wäre Ihnen dankbar, wenn Sie die folgenden Fragen beantworten könnten:',link:'Den vollständigen Eintrag finden Sie hier:',thanks:'Vielen Dank für Ihre Zeit.',bye:'Mit freundlichen Grüßen',you:'[Ihr Name]',
  q:{commit:n=>`Wird sich ${n} zu Netto-Null verpflichten, und bis zu welchem Jahr?`,cut2030:n=>`Um wie viel wird ${n} die Emissionen bis 2030 senken?`,who:()=>'Wer in der Regierung ist für die Klimaziele verantwortlich, und wann wird ein Plan veröffentlicht?',board:()=>'Welches Vorstandsmitglied ist für die Klimastrategie verantwortlich?',lock_g:n=>`Wird ${n} sein Netto-Null-Ziel gesetzlich verankern?`,lock_c:()=>'Wird der Vorstand das Ziel formell beschließen und die Vergütung der Führungskräfte daran koppeln?',interim:n=>`Um wie viel wird ${n} die Emissionen bis 2030 und 2035 gesenkt haben, gemessen an welchem Basisjahr?`,gas:()=>'Warum klammert das Ziel Methan und andere Gase außer CO₂ aus?',s3:()=>'Wird das Ziel auch die Emissionen von Lieferanten und aus der Nutzung der Produkte durch Kunden (Scope 3) erfassen?',cons:n=>`Wird ${n} die Emissionen der importierten Güter ausweisen?`,plan:()=>'Wo ist der Plan, der zeigt, welche Maßnahmen welche Minderungen bringen, und bis wann?',rep:n=>`Wird ${n} jedes Jahr über Fortschritte berichten?`,acc:()=>'Wer ist formell verantwortlich, wenn das Ziel verfehlt wird?',offsets:()=>'Welcher Anteil des Ziels hängt von CO₂-Kompensationen ab, und welche Qualitätsregeln gelten?',rem:n=>`Wird ${n} getrennte Ziele für die Senkung von Emissionen und für die Entnahme von CO₂ festlegen?`,track:n=>`Ist ${n} auf Kurs für sein Zwischenziel, und was sagt die unabhängige Überprüfung?`}},
it:{subj:n=>`Domanda sull’obiettivo di zero emissioni nette di ${n}`,greet:'Gentile [nome],',
  intro:(n,y,k,t,h)=>`Le scrivo in merito agli impegni climatici di ${n}. Secondo il Net Zero Tracker, ${n} ${h?`ha un obiettivo di zero emissioni nette${y?` entro il ${y}`:''} e soddisfa ${k} dei ${t} controlli di credibilità`:'non ha un obiettivo di zero emissioni nette'}.`,
  grate:'Le sarei grato/a se potesse rispondere alle seguenti domande:',link:'La scheda completa è qui:',thanks:'La ringrazio per l’attenzione.',bye:'Cordiali saluti,',you:'[Il suo nome]',
  q:{commit:n=>`${n} si impegnerà a raggiungere lo zero netto di emissioni, e entro quale anno?`,cut2030:n=>`Di quanto ridurrà le emissioni ${n} entro il 2030?`,who:()=>'Chi nel governo è responsabile degli obiettivi climatici, e quando sarà pubblicato un piano?',board:()=>'Quale membro del consiglio di amministrazione è responsabile della strategia climatica?',lock_g:n=>`${n} inserirà il suo obiettivo di zero emissioni nette in una legge?`,lock_c:()=>'Il consiglio adotterà formalmente l’obiettivo e vi collegherà la retribuzione dei dirigenti?',interim:n=>`Di quanto avrà ridotto le emissioni ${n} entro il 2030 e il 2035, rispetto a quale anno di riferimento?`,gas:()=>'Perché l’obiettivo esclude il metano e gli altri gas diversi dalla CO₂?',s3:()=>'L’obiettivo coprirà le emissioni dei fornitori e dell’uso dei prodotti da parte dei clienti (scope 3)?',cons:n=>`${n} rendicontherà le emissioni causate dai beni che importa?`,plan:()=>'Dov’è il piano che mostra quali misure producono quali riduzioni, e entro quando?',rep:n=>`${n} pubblicherà i progressi ogni anno?`,acc:()=>'Chi è formalmente responsabile se l’obiettivo non viene raggiunto?',offsets:()=>'Quale quota dell’obiettivo dipende dalle compensazioni di carbonio, e quali regole di qualità si applicano?',rem:n=>`${n} fisserà obiettivi separati per ridurre le emissioni e per rimuovere carbonio?`,track:n=>`${n} è sulla buona strada per raggiungere il suo traguardo, e cosa dice la revisione indipendente?`}},
ar:{rtl:1,subj:n=>`سؤال حول هدف صافي الانبعاثات الصفرية لدى ${n}`,greet:'السيد/السيدة [الاسم] المحترم/ة،',
  intro:(n,y,k,t,h)=>`أكتب إليكم بشأن التزامات ${n} المناخية. وفقًا لـ Net Zero Tracker، ${h?`لدى ${n} هدف لصافي انبعاثات صفري${y?` بحلول عام ${y}`:''}، ويستوفي ${k} من أصل ${t} من فحوص المصداقية`:`ليس لدى ${n} هدف لصافي انبعاثات صفري`}.`,
  grate:'أكون ممتنًا لو تفضلتم بالإجابة عن الأسئلة التالية:',link:'الصفحة الكاملة هنا:',thanks:'شكرًا لكم على وقتكم.',bye:'مع خالص التقدير،',you:'[اسمك]',
  q:{commit:n=>`هل ستلتزم ${n} بتحقيق صافي انبعاثات صفري، وفي أي عام؟`,cut2030:n=>`ما مقدار الخفض الذي ستحققه ${n} بحلول عام 2030؟`,who:()=>'من المسؤول في الحكومة عن الأهداف المناخية، ومتى ستُنشر خطة؟',board:()=>'أي عضو في مجلس الإدارة مسؤول عن استراتيجية المناخ؟',lock_g:n=>`هل ستدرج ${n} هدف صافي الانبعاثات الصفرية في القانون؟`,lock_c:()=>'هل سيعتمد مجلس الإدارة الهدف رسميًا ويربط به مكافآت المديرين التنفيذيين؟',interim:n=>`ما الذي ستكون ${n} قد خفضته بحلول عامي 2030 و2035، مقارنةً بأي سنة أساس؟`,gas:()=>'لماذا يستثني الهدف غاز الميثان والغازات الأخرى غير ثاني أكسيد الكربون؟',s3:()=>'هل سيشمل الهدف انبعاثات الموردين وانبعاثات استخدام العملاء للمنتجات (النطاق 3)؟',cons:n=>`هل ستُبلغ ${n} عن الانبعاثات الناتجة عن السلع التي تستوردها؟`,plan:()=>'أين الخطة التي توضح أي الإجراءات تحقق أي تخفيضات، وبحلول متى؟',rep:n=>`هل ستنشر ${n} تقريرًا عن التقدم كل عام؟`,acc:()=>'من المسؤول رسميًا إذا لم يتحقق الهدف؟',offsets:()=>'ما حصة الهدف التي تعتمد على تعويضات الكربون، وما قواعد الجودة المطبقة؟',rem:n=>`هل ستضع ${n} أهدافًا منفصلة لخفض الانبعاثات ولإزالة الكربون؟`,track:n=>`هل ${n} على المسار الصحيح لتحقيق هدفها المرحلي، وماذا تقول المراجعة المستقلة؟`}},
zh:{subj:n=>`关于${n}净零目标的询问`,greet:'尊敬的[姓名]：',
  intro:(n,y,k,t,h)=>`我写信是想了解${n}的气候承诺。根据净零追踪器（Net Zero Tracker），${h?`${n}设定了${y?`${y}年`:''}净零目标，并满足${t}项可信度检查中的${k}项`:`${n}没有净零目标`}。`,
  grate:'恳请您回答以下问题：',link:'完整条目见：',thanks:'感谢您抽出时间。',bye:'此致敬礼，',you:'[您的姓名]',
  q:{commit:n=>`${n}是否会承诺实现净零排放？目标年份是哪一年？`,cut2030:n=>`${n}到2030年将减排多少？`,who:()=>'政府中由谁负责气候目标？计划何时发布？',board:()=>'董事会中哪位成员负责气候战略？',lock_g:n=>`${n}是否会把净零目标写入法律？`,lock_c:()=>'董事会是否会正式通过该目标，并将高管薪酬与之挂钩？',interim:n=>`${n}到2030年和2035年将减排多少？以哪一年为基准年？`,gas:()=>'为什么该目标不包括甲烷和二氧化碳以外的其他气体？',s3:()=>'该目标是否会涵盖供应商排放以及客户使用产品产生的排放（范围3）？',cons:n=>`${n}是否会报告其进口商品所造成的排放？`,plan:()=>'说明哪些措施带来多少减排、何时完成的计划在哪里？',rep:n=>`${n}是否会每年公布进展？`,acc:()=>'如果未能达成目标，由谁正式负责？',offsets:()=>'目标有多大比例依赖碳抵消，适用哪些质量规则？',rem:n=>`${n}是否会分别为减排和碳移除设定独立目标？`,track:n=>`${n}是否有望实现其阶段性目标？独立评估结果如何？`}}
};
if (window.EMLX) { Object.assign(EML_LANGS, window.EMLX.langs); Object.assign(EML_ISO, window.EMLX.iso); Object.assign(EML, window.EMLX.t); }
function whoToWrite(e){
  const c = e.t === 'country' ? e : D.find(x => x.t === 'country' && x.c === e.c), a2 = c && c.a2 ? c.a2.toUpperCase() : '', cn = c ? c.n : (e.cn || ''),
    q = t => 'https://www.google.com/search?q=' + encodeURIComponent(t), L = [];
  if (e.t === 'company') L.push([q(e.n + ' sustainability head OR investor relations contact'), 'Search for the company’s sustainability or investor relations contact']);
  else {
    if (e.t === 'city') L.push([q(e.n + ' mayor office contact'), 'Search for the mayor’s office']);
    else if (e.t === 'region') L.push([q(e.n + ' environment minister contact'), 'Search for the ' + regTerm(e)[0] + ' environment minister']);
    else L.push([q(plainName(e) + ' ministry of environment climate change contact'), 'Search for the climate or environment ministry']);
    if (a2) L.push(['https://data.ipu.org/parliament/' + a2, 'Parliament of ' + (c ? plainName(c) : cn) + ' (Inter-Parliamentary Union directory, with contact details and the official website)']);
  }
  return `<div class="note" style="margin-top:12px;font-size:14px"><b>Whom to email</b><ul style="margin:6px 0 0;padding-left:18px">${L.map(([h, t]) => `<li><a href="${h}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul><span class="muted">These are starting points. Check the person’s role on an official page before you send anything.</span></div>`;
}
function emlKeys(e){
  const cs = checks(e), gv = e.t !== 'company';
  if (!isNZ(e)) return ['commit', 'cut2030', gv ? 'who' : 'board'];
  const key = c => c.id === 'lock' ? (gv ? 'lock_g' : 'lock_c') : c.id;
  const ok = ['lock','interim','gas','s3','cons','plan','rep','acc','offsets','rem'];
  const out = cs.filter(c => (c.v === 'no' || c.v === 'part') && ok.includes(c.id)).map(key);
  cs.filter(c => c.v === 'unk' && ok.includes(c.id)).slice(0, 2).forEach(c => out.push(key(c)));
  return out.length ? out : ['track'];
}
const devnum = s => s.split(/(https?:\/\/\S+)/).map((p, i) => i % 2 ? p : p.replace(/[0-9]/g, d => '०१२३४५६७८९'[d])).join('');
function emlName(e, lang){
  const v = window.NZN && window.NZN[e.s];
  if (v && v[0] === lang) return v[1].replace(/\s*\(.*\)\s*$/, '');
  if (e.t === 'country' && e.a2) { try { const r = new Intl.DisplayNames([lang], {type: 'region'}).of(e.a2.toUpperCase()); if (r && r !== e.a2.toUpperCase()) return r; } catch (x) {} }
  return e.n;
}
function emailDraftLang(e, lang){
  if (lang === 'en' || !EML[lang]) return Object.assign(emailDraft(e), {rtl:false});
  const L = EML[lang], cs = checks(e), t = tally(cs), n = emlName(e, lang), y = isNZ(e) ? year(e) : '';
  const qs = emlKeys(e).slice(0, 3).map(k => L.q[k](n));
  const body = `${L.greet}\n\n${L.intro(n, y, t.yes, cs.length, isNZ(e))}\n\n${L.grate}\n\n${qs.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n${L.link} ${official(e)}\n\n${L.thanks}\n\n${L.bye}\n${L.you}`;
  return lang === 'hi' ? {subject: devnum(L.subj(n)), body: devnum(body), rtl: false} : {subject: L.subj(n), body, rtl: !!L.rtl};
}
function emailDraft(e){
  const qs = asks(e).slice(0, 3), cs = checks(e), t = tally(cs);
  const subject = `Question about ${nm(e)}'s net zero target`;
  const body = `Dear [name],\n\nI am writing about ${nm(e)}'s climate commitments. According to the Net Zero Tracker, ${isNZ(e) ? `${nm(e)} has set this target: ${targetPhrase(e)}, and meets ${t.yes} of ${cs.length} credibility checks.` : `${nm(e)} has no net zero target.`}\n\nI would be grateful if you could answer these questions:\n\n${qs.map((q, i) => `${i + 1}. ${q[0]}`).join('\n')}\n\nThe full entry is here: ${official(e)}\n\nThank you for your time.\n\n[Your name]`;
  return {subject, body};
}
function shareCard(e, fmt, lang){
  const X = lang && lang !== 'en' && window.EMLS && window.EMLS[lang], RT = lang === 'ar', dn = v => lang === 'hi' ? devnum(String(v)) : v, nmx = X ? dn(emlName(e, lang)) : nm(e);
  const W = 1080, H = fmt === 'story' ? 1920 : 1080, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), F = 'Outfit, Helvetica, Arial, sans-serif', cs = checks(e), t = tally(cs);
  const wrap = (txt, x, y, w, lh) => { let line = ''; const cjk = /[\u3000-\u9fff\uac00-\ud7af]/.test(txt); for (const wd of (cjk ? [...txt] : txt.split(' '))) { const tr = line ? line + (cjk ? '' : ' ') + wd : wd; if (g.measureText(tr).width > w && line) { g.fillText(line, x, y); y += lh; line = wd; } else line = tr; } g.fillText(line, x, y); return y + lh; };
  g.fillStyle = '#271039'; g.fillRect(0, 0, W, H);
  const PX = RT ? W - 80 : 80; g.direction = RT ? 'rtl' : 'ltr'; g.textAlign = RT ? 'right' : 'left';
  g.fillStyle = '#E13B26'; g.fillRect(0, 0, W, 16);
  const top = fmt === 'story' ? 260 : 120; let y = top;
  g.fillStyle = '#ffb3a8'; g.font = `600 34px ${F}`; g.fillText(((X ? X.ty[e.t] : typeWord(e)) + (e.cn && e.t !== 'country' ? ' · ' + e.cn : '')).toUpperCase(), PX, y); y += 90;
  g.fillStyle = '#fff'; g.font = `700 78px ${F}`; y = wrap(nmx, PX, y, W - 160, 92) + 10;
  g.fillStyle = '#e0d6ea'; g.font = `400 46px ${F}`; y = wrap(X ? (isNZ(e) ? dn(X.tgt(year(e))) : X.no) : targetPhrase(e), PX, y, W - 160, 60) + 30;
  if (isNZ(e)) {
    g.fillStyle = '#fff'; const sc = X ? dn(X.of(t.yes, cs.length)) : t.yes + ' of ' + cs.length; let fs = 150; g.font = `700 ${fs}px ${F}`; while (g.measureText(sc).width > W - 160 && fs > 56) { fs -= 6; g.font = `700 ${fs}px ${F}`; } g.fillText(sc, PX, y + 120); y += 160;
    g.fillStyle = '#e0d6ea'; g.font = `400 42px ${F}`; y = wrap(X ? X.ck : 'credibility checks met', PX, y + 40, W - 160, 52) + 40;
    const gaps = cs.filter(k => k.v === 'no').map(k => shortGap[k.id]).filter(Boolean).slice(0, 3);
    if (gaps.length && !X) { g.fillStyle = '#ffb3a8'; g.font = `600 36px ${F}`; g.fillText('GAPS', PX, y + 20); y += 60; g.fillStyle = '#fff'; g.font = `400 42px ${F}`; gaps.forEach(q => { y = wrap('✗  ' + q, PX, y + 20, W - 160, 56); }); }
  } else { g.fillStyle = '#fff'; g.font = `700 96px ${F}`; wrap(X ? X.no : 'No net zero target', PX, y + 100, W - 160, 112); }
  g.fillStyle = '#ffffff'; g.font = `700 40px ${F}`; g.fillText('NET ZERO TRACKER', PX, H - 150);
  g.fillStyle = '#e0d6ea'; g.font = `400 34px ${F}`; g.fillText(official(e).replace('https://', ''), PX, H - 96);
  return c;
}
function renderShare(e){
  const em = emailDraftLang(e, emlLangOf(e)), tx = shareText(e, emlLangOf(e)); let LG = emlLangOf(e);
  $('#sh-out').innerHTML = `<div class="card" style="margin-bottom:18px">
      <label class="muted" style="font-size:14px" for="em-lang"><b>Language</b> (for the post, the picture card and the email)</label><br><select id="em-lang" style="width:100%;max-width:420px;font:inherit;padding:10px;border:1px solid var(--line-2);border-radius:8px;margin-bottom:4px">${Object.entries(EML_LANGS).map(([k, v]) => `<option value="${k}"${k === emlLangOf(e) ? ' selected' : ''}>${v}${k === emlLangOf(e) && k !== 'en' ? ' (language of this country)' : ''}</option>`).join('')}</select>
      <p class="muted" id="em-langnote" style="font-size:13px;margin:0 0 10px" ${emlLangOf(e) === 'en' ? 'hidden' : ''}>Translations are drafts. Please have a fluent speaker check them before sending. Changing the language also rewrites the post and picture card, and replaces any edits to the post, subject and message.</p>
    </div><div class="grid2" style="align-items:start">
    <div class="card"><h3>Post</h3>
      <textarea id="sh-text" rows="5" style="width:100%;font:inherit;padding:10px;border:1px solid var(--line-2);border-radius:8px">${esc(tx)}</textarea>
      <p class="muted" style="font-size:13.5px;margin:4px 0 12px"><span id="sh-n"></span> The link to the entry is added automatically.</p>
      <div class="actions" style="flex-wrap:wrap">
        <a class="btn btn-purple btn-sm" id="sh-x" target="_blank" rel="noopener">Post on X</a>
        <a class="btn btn-ghost btn-sm" id="sh-bs" target="_blank" rel="noopener">Bluesky</a>
        <a class="btn btn-ghost btn-sm" id="sh-fb" target="_blank" rel="noopener">Facebook</a>
        <a class="btn btn-ghost btn-sm" id="sh-li" target="_blank" rel="noopener">LinkedIn</a>
        <button class="btn btn-ghost btn-sm" id="sh-copy">Copy text</button></div>
      <h3 class="mt2">Picture card</h3>
      <p class="muted mt0" style="font-size:14.5px">Instagram does not allow posting from a website, so download the card and add it to your story or post in the app.</p>
      <div class="actions" style="flex-wrap:wrap"><button class="btn btn-purple btn-sm" data-card="story">Download story (1080×1920)</button><button class="btn btn-ghost btn-sm" data-card="post">Download square post</button></div>
      <canvas id="sh-prev" style="max-width:220px;margin-top:14px;border-radius:8px;box-shadow:var(--shadow)"></canvas></div>
    <div class="card"><h3>Email a policymaker</h3>
      <label class="muted" style="font-size:14px">To (their email address)</label><input id="em-to" type="email" placeholder="name@council.gov" style="width:100%;font:inherit;padding:10px;border:1px solid var(--line-2);border-radius:8px;margin-bottom:10px">
      <label class="muted" style="font-size:14px">Subject</label><input id="em-sub" value="${esc(em.subject)}" style="width:100%;font:inherit;padding:10px;border:1px solid var(--line-2);border-radius:8px;margin-bottom:10px">
      <label class="muted" style="font-size:14px">Message</label><textarea id="em-body" rows="13" style="width:100%;font:inherit;padding:10px;border:1px solid var(--line-2);border-radius:8px">${esc(em.body)}</textarea>
      <div class="actions mt1" style="flex-wrap:wrap"><a class="btn btn-purple btn-sm" id="em-go">Open in my email program</a><button class="btn btn-ghost btn-sm" id="em-copy">Copy message</button></div>
      <p class="muted" style="font-size:13.5px;margin-bottom:0">We do not know who represents you, so add the address yourself. Replace [name] and [Your name] before sending.</p>${whoToWrite(e)}</div>
  </div>`;
  const ta = $('#sh-text'), url = official(e), upd = () => {
    const q = encodeURIComponent;
    $('#sh-x').href = `https://twitter.com/intent/tweet?text=${q(ta.value)}&url=${q(url)}`;
    $('#sh-bs').href = `https://bsky.app/intent/compose?text=${q(ta.value + ' ' + url)}`;
    $('#sh-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${q(url)}`;
    $('#sh-li').href = `https://www.linkedin.com/sharing/share-offsite/?url=${q(url)}`;
    const left = 280 - ta.value.length - 24; $('#sh-n').textContent = left >= 0 ? left + ' characters left for X.' : 'Over the X limit by ' + (-left) + ' characters.';
    $('#em-go').href = `mailto:${encodeURIComponent($('#em-to').value.trim())}?subject=${q($('#em-sub').value)}&body=${q($('#em-body').value)}`;
  };
  ['#sh-text', '#em-to', '#em-sub', '#em-body'].forEach(i => $(i).addEventListener('input', upd)); upd();
  const rtl = d => { $('#em-sub').dir = $('#em-body').dir = d ? 'rtl' : 'ltr'; };
  rtl(em.rtl);
  $('#em-lang').onchange = () => { const l = $('#em-lang').value, d = emailDraftLang(e, l); LG = l; ta.value = shareText(e, l); drawPrev(); $('#em-sub').value = d.subject; $('#em-body').value = d.body; rtl(d.rtl); $('#em-langnote').hidden = l === 'en'; upd(); };
  $('#sh-copy').onclick = () => copy(ta.value + ' ' + url);
  $('#em-copy').onclick = () => copy('Subject: ' + $('#em-sub').value + '\n\n' + $('#em-body').value);
  function drawPrev() { const pv = shareCard(e, 'story', LG), pc = $('#sh-prev'); pc.width = pv.width; pc.height = pv.height; pc.getContext('2d').drawImage(pv, 0, 0); } drawPrev();
  $$('[data-card]').forEach(b => b.onclick = () => { const a = document.createElement('a'); a.download = `${e.s}-${b.dataset.card}.png`; a.href = shareCard(e, b.dataset.card, LG).toDataURL('image/png'); a.click(); });
}
P.advocates.after = () => { wireSearch('s-act'); wireSearch('s-share', e => { $('#s-share input').value = e.n; $('#s-share .sugg').hidden = true; renderShare(e); }); };

/* ---------- NOTES (for the NZT team) ---------- */
P.notes = () => `<section class="tight band"><div class="wrap">
  <p class="eyebrow">For the Net Zero Tracker team</p><h1 class="h-brand" style="font-size:clamp(28px,4vw,40px)">About this prototype</h1>
  <p class="lede mt0">A working redesign that makes the tracker easier to use for policymakers and advocates. It keeps the brand (purple, red call-to-action, uppercase headings, logo, grey bands) and uses the live dataset of ${fmt(D.length)} entries. Headline counts match the live homepage exactly.</p></div></section>
  <section class="tight"><div class="wrap grid2">
    <div><h2 class="h-brand" style="font-size:24px">What changed</h2>
    <div class="steps mt1">
      <div><h3>Plain-language profiles</h3><p>Each entity opens with a generated "short version" paragraph, a timeline (today → milestone → target year) and a 6-step "how firm is it?" ladder in place of rows of highlighted labels.</p></div>
      <div><h3>A credibility checklist</h3><p>Existing indicators are regrouped under the site's own four headings (Targets, Coverage, Governance, Offsets &amp; sinks), each phrased as a question with a yes/partly/no/unknown icon, a written answer and a "why it matters" note.</p></div>
      <div><h3>Color never works alone</h3><p>The companies table used red, amber and green dots with no labels. Here every verdict has an icon shape and a text label, so it works for colour-blind readers and in print.</p></div>
      <div><h3>Audience paths</h3><p>Guides for policymakers (benchmarks, drafting checklist, briefing paragraph) and for advocates (warning signs, question generator, responsible-use and citation notes).</p></div>
      <div><h3>Compare and export</h3><p>Side-by-side comparison of up to 4 entries of any type, shareable links, and CSV export of any filtered list.</p></div>
      <div><h3>One integrated map</h3><p>Countries, regions and cities are on a single zoomable map, as on the live site. A side panel holds the layer switches and the colour menu, and the key sits directly under whichever colour option is selected, so there is no separate legend to hunt for. There are four ways to colour it: how firm the commitment is, the target year, whether there is a milestone before 2035, and how many credibility checks are met.</p></div>
      <div><h3>A picture of the companies data</h3><p>A treemap of the 1,981 largest public companies, one box each, grouped by sector and sized by revenue. It is coloured with the same four options and the same legend, and every box links to the company profile.</p></div>
      <div><h3>Good net zero, in full</h3><p>The six-initiative comparison is rebuilt with all of its data: every criterion rated by every initiative, the two convergence levels, definitions, and the quoted explanation and source page behind 75 entries. New views show where the experts agree and what each initiative covers, with plain-English summaries added.</p></div>
      <div><h3>Clearer graphics elsewhere</h3><p>Donut charts become labelled bars, and a new "credibility gap" chart shows which elements targets lack. The "how firm is the commitment" ladder uses the same light-to-dark green scale as the map.</p></div>
      <div><h3>A Learn page that starts from the basics</h3><p>It opens with why net zero matters for the climate and the Paris Agreement goals, a greenhouse-effect diagram, and an interactive "net zero in one picture" that shows emissions as pollution from power plants, cars and cows, then what cutting, removing and relying on offsets each look like. A section on offsets, removals and greenwashing links from the picture's warnings.</p></div>
      <div><h3>Explore: governments or companies at the top</h3><p>A switch above the table shows the map (governments) or the treemap (companies). Hovering "Next milestone" lists every later milestone up to the target. A small key explains the check icons.</p></div>
      <div><h3>Choose what to compare with</h3><p>On every profile, "How it compares" can be set to the entry's region, its country, the world, or similar size (or sector and revenue for companies). Regions are our own grouping (for example the Middle East and North Africa, South and Central Asia, China on its own). Cities with fewer than 500,000 people, which the Tracker does not cover, pick a city to compare with instead.</p></div>
      <div><h3>The effects of climate change, place by place</h3><p>A dropdown on every country, region and city profile shows warming stripes since 1850, projected warming to 2100 on three emissions paths, very hot days, rainfall change, sea level for coastal cities and the cost of natural disasters as a share of GDP (countries only). Every chart can be shared or downloaded as a picture. The home page adds three global indicators: warming, CO₂ in the air and reported weather disasters. A clickable map at the top of each profile shows where the place is.</p></div>
      <div><h3>Share it and write to someone who can act</h3><p>The advocates page drafts a post for X, Facebook and LinkedIn, downloads a picture card for Instagram stories or posts, and drafts an email to a policymaker. Emails can be written in 17 languages (English, Spanish, French, Portuguese, German, Italian, Arabic, Chinese, Russian, Hindi, Japanese, Korean, Indonesian, Turkish, Swahili, Dutch and Polish), with local place names, and a “whom to email” box links to the official parliament directory and a search for the right ministry. Nothing is sent from the site.</p></div>
      <div><h3>The live site's menu, rebuilt</h3><p>A "More" menu (and the footer) now has Analysis, Insights, Methodology, Volunteering, In the news, About and The team, plus Bluesky and LinkedIn links. Analysis, Insights and In the news list every item with search and filters and link to the articles on zerotracker.net. Methodology, Volunteering, The team and the terms pages are rebuilt here from the live content.</p></div>
      <div><h3>Emissions history on every profile</h3><p>Countries show greenhouse gas emissions since 1850 (Our World in Data, from Jones et al. 2024). Cities and regions show 1970 to 2022 from the European Commission's EDGAR v8.0, summed from its 0.1° grid over the region's boundary, or over roughly 6 to 45 km around a city centre depending on its population. A dashed line shows a straight path from today to the target milestone and net zero year. City figures are approximate and will differ from official inventories. Companies show worldwide Scope 1 and 2 emissions where a usable figure exists: as reported by the company (compiled by Wikirate) or, for some heavy-industry companies, as estimated by Climate TRACE.</p></div>
      <div><h3>Global emissions and pathways on Explore</h3><p>With countries selected, a chart below the table shows how the largest emitters add up to the global total since 1990, and the Climate Action Tracker's scenarios ahead: a Paris-aligned pathway, current policies, all NDCs met, all pledges met, and a simple "no further action" trend. The Compare page can plot emissions and each entry's target path on one chart, and profiles can be compared with places of similar GDP.</p></div>
      <div><h3>FAQs and About inside the prototype</h3><p>The live site's FAQs and About and contact pages are rebuilt here with the same content, and a dismissible newsletter box replaces the top strip.</p></div>
    </div></div>
    <div><h2 class="h-brand" style="font-size:24px">Possible errors on the live site</h2>
      <ul class="flags">
        <li>Company filter "Target year" lists <b>1000</b> (BAIC Motor's entry). Probably a data-entry error.</li>
        <li>Meritz Financial's annual revenue is recorded as <b>$115.6 trillion</b>, more than 100 times the largest company. It is probably in Korean won. This prototype leaves that figure out.</li>
        <li>Good Net Zero page: typo "Please note that <i>he</i> comparison…".</li>
        <li>"Updated in real-time, with a commitment to 100% accuracy" is a strong claim. Consider "We review entries regularly. Tell us if something has changed."</li>
        <li>Headline company count (1,981) excludes private companies, but the table includes them (2,080). Worth saying so on the page.</li>
        <li>Mistyped entity URLs return a raw "500 Internal Server Error" page instead of a friendly 404 with search.</li>
        <li>The companies table has 14 columns with jargon headers ("End target status", "Scope 3 coverage") and no inline explanations.</li>
      </ul>
      <h2 class="h-brand mt2" style="font-size:24px">Open questions for the team</h2>
      <ul class="flags">
        <li>Is the "X of Y checks met" summary acceptable, or should profiles show checks without a total?</li>
        <li>The brand font (franzSans) is licensed, so this prototype uses Outfit. The production site would use the real font.</li>
        <li>Cities in the data: the methodology says all cities over 500,000 people, but 103 entries are smaller and the population list and its date are not given. The prototype only compares cities of 500,000 or more.</li>
        <li>The regions used for comparison (eight on the live site's data, nine here) are not defined in the methodology. The prototype's grouping is our own and the team may prefer its own.</li>
        <li>The plain-language wording on the Learn page, the offsets section and the translated emails is our own draft. The translations have not been checked by native speakers.</li>
        <li>The newsletter box links to the live Mailchimp sign-up page. It can be closed and stays closed for the rest of the visit.</li>
        <li>The map uses the live site's own boundary and city-location files. 16 regions and 1 city have no location in them yet, so they appear in the tables but not on the map.</li>
      </ul>
      <div class="note mt2">Prototype by Shiva Rajbhandari, ${META.generated || ''}. Data: Net Zero Tracker public dataset (entries updated to ${esc((META.source||'').split('to ').pop())}). Not indexed by search engines.</div>
    </div>
  </div></section>
  <section class="tight band" id="emissions"><div class="wrap prose-wide">
    <h2 class="h-brand" style="font-size:26px">Methodology: the emissions history</h2>
    <p class="lede mt0">The Tracker's own <a href="#/methodology">Methodology</a> page describes how its targets are researched. The emissions charts on each profile are an addition made for this prototype, built as follows.</p>
    <div class="grid2 mt1" style="align-items:start">
      <div><h3>Countries</h3><p>Total greenhouse gas emissions, including land use and forestry, in million tonnes of CO₂ equivalent a year, from 1850. From <a href="https://ourworldindata.org/co2-and-greenhouse-gas-emissions" target="_blank" rel="noopener">Our World in Data</a>, which compiles the series of Jones et al. (2024), CC BY. Countries are matched by ISO country code (191 of 198 match). Rare gaps are filled in a straight line. Estimates before about 1950 are rough.</p>
      <h3>Regions</h3><p>Yearly 1970 to 2022 from the European Commission's <a href="https://edgar.jrc.ec.europa.eu/dataset_ghg80" target="_blank" rel="noopener">EDGAR v8.0</a> gridded totals (CO₂ from fossil fuels and industry, methane, nitrous oxide and F-gases, weighted by 100-year warming potential, 0.1° or about 11 km cells, CC BY 4.0). Each region is the sum of the grid cells whose centre falls inside its boundary on the map (700 of 722 regions). EDGAR leaves out land use and biomass burning, so these figures are not comparable with the country series.</p></div>
      <div><h3>Cities</h3><p>Each city is matched to its urban centre outline in the Joint Research Centre's <a href="https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php" target="_blank" rel="noopener">Global Human Settlement Layer</a> (GHS-UCDB R2024A): the outline that contains the city point, or the nearest within 12 km. 1,173 of 1,184 cities matched. 135 of those share an urban centre with another city in the Tracker, so for them the outline is cut to about 10 km or more around the city centre (11 km × population in millions^0.45) to avoid counting the same emissions twice. The 11 cities with no outline use that same circle.</p>
      <p>EDGAR cells are larger than most urban outlines, so a cell that is partly inside an outline counts at three times its overlap (capped at all of it). I chose this factor by comparing against the Global Human Settlement Layer's own EDGAR-based city totals for 2022: across the 1,038 cities that have an outline to themselves it gave a median ratio of 0.97 to their figure, with about 80% of cities within 25%, in each of 1990, 2000, 2010, 2020 and 2022.</p>
      <h3>The dashed path</h3><p>If a profile has a stated reduction against a base year, the milestone is that base year's figure from the same series times one minus the percentage. The line from today to the milestone and to the net zero year is a straight line for illustration, not a forecast.</p></div>
    </div>
    <h3 class="mt2">Companies</h3>
    <div class="grid2" style="align-items:start">
      <div><p>Only <b>worldwide</b> figures are used. Government registries such as the EU Emissions Trading System, the US EPA Greenhouse Gas Reporting Program or Australia's NGER are more tightly checked, but they cover only a company's sites in one country or region, so they are not shown. They were used only as a check: a worldwide total far below the same company's figure in one registry was treated as an error and dropped.</p>
      <p><b>First choice: what the company reported.</b> Scope 1 (direct) and Scope 2 (bought electricity, heat and steam) emissions from the company's GRI and CDP disclosures, as compiled by <a href="https://wikirate.org" target="_blank" rel="noopener">Wikirate</a> (CC BY 4.0, its "Commons" Scope 1 and Scope 2 metrics). Matched to Tracker companies by name, with doubtful matches checked by hand.</p>
      <p><b>Scope 2 method.</b> Location-based Scope 2 (the average emissions of the local grid) is used wherever Wikirate records it. Most figures do not say which method was used, so they are labelled as possibly counting renewable-energy certificates: paper claims that, like <a href="#/learn/offsets">offsets</a>, can lower a company's reported emissions without the grid getting cleaner. A Scope 2 of zero can only come from counting certificates and is labelled so. The two layers are shown separately so a fall in Scope 2 can be told apart from a fall in direct emissions.</p></div>
      <div><p><b>Checks.</b> A year is dropped if it is 30 times or more away from the company's typical value, more than 3 times away from both neighbouring years, or (at either end) more than 2.5 times away from its neighbour. These patterns are almost always tonnes typed as thousands of tonnes. If the series jumps 5 times or more between two reports, the company changed what it counts, and only the longer stretch is kept. A company is left out if its largest figure is under 0.3 tonnes per US$1 million of revenue, or if fewer than two years remain.</p>
      <p><b>Backup: Climate TRACE estimates.</b> For power companies, and for steel, aluminium and chemicals makers, with no usable reported figures, the chart shows <a href="https://climatetrace.org" target="_blank" rel="noopener">Climate TRACE</a> estimates (CC BY 4.0) for 2021 onwards: the sites owned by the company and by every subsidiary it owns more than half of, from Climate TRACE's ownership data, added up by this prototype. These are independent estimates from satellite and other data, not company figures, and they count direct (Scope 1) emissions only. Oil and gas companies are left out: their fields are usually shared between partners, and Climate TRACE credits each partner with the whole field, which overstates them several times over. An estimate is also left out if it is below 300 tonnes per US$1 million of revenue for a power company or 500 for a materials company (a sign that plants are missing), above 20,000, or below the same company's figure in any national registry (EU, US, Canada, Australia or Japan). Companies whose history includes plants bought later are also left out, because Climate TRACE applies today's ownership to every year. 27 companies passed.</p></div>
    </div>
    <div class="note mt2"><b>Limits.</b> These are modelled grid totals, not official inventories, and city boundaries differ from administrative ones. Please treat city numbers as indicative. Company figures depend on what each company chose to report and are not independently verified.</div>
  </div></section>
  <section class="tight" id="stripes"><div class="wrap prose-wide">
    <h2 class="h-brand" style="font-size:26px">Effects of climate change: how they are made</h2>
    <p class="muted mt0">Each profile for a country, region or city has a dropdown with warming stripes, projections, very hot days, rainfall, sea level (coastal cities) and, for countries, the cost of natural disasters as a share of GDP. The home page shows three global indicators.</p>
    <div class="grid2" style="align-items:start">
      <div><p><b>Projections.</b> From the <a href="https://climateknowledgeportal.worldbank.org" target="_blank" rel="noopener">World Bank Climate Change Knowledge Portal</a>: the median of the CMIP6 climate models on a 0.25° grid, for three emissions pathways (SSP1-2.6, SSP2-4.5 and SSP3-7.0). We averaged the grid over each country or region outline and took the nearest cell for a city. Temperature and rainfall are shown against each model's own 1995–2014 average, and measured temperatures from Berkeley Earth are shown against their own 1995–2014 average, so the two parts of the chart are comparable. The pathways are only roughly matched to the Tracker's scenarios: low emissions is about the “all pledges met” path, middle is about where current policies lead, and high is worse than current policies.</p>
      <p><b>Very hot days.</b> Days a year when the daily maximum reaches 35°C, from the same models (climatologies for 1995–2014 and four 20-year periods to 2099). These are modelled values, so the 1995–2014 figure can differ from local weather records.</p></div>
      <div><p><b>Rainfall.</b> The percentage change in the yearly total against 1995–2014. Rainfall is much less certain than temperature and models often disagree about the direction, so treat it as a rough guide.</p>
      <p><b>Sea level.</b> For 131 coastal cities, the nearest long tide-gauge record within 60 km from the <a href="https://psmsl.org" target="_blank" rel="noopener">Permanent Service for Mean Sea Level</a> (revised local reference, annual means, at least 50 years ending after 2004). It is sea level relative to the land, so sinking or rising land is included.</p>
      <p><b>Disasters.</b> Estimated economic damage each year from natural disasters as a share of GDP, 2000–2024, for countries only (EM-DAT via Our World in Data). The dollar figures in the hover multiply that share by GDP in current US dollars from the World Bank; they are not adjusted for inflation. Only disasters with a reported damage estimate are counted. The home page counts reported weather- and climate-related disasters worldwide (floods, storms, droughts, wildfires and extreme temperatures) from EM-DAT via Our World in Data; part of the rise over time reflects better reporting. Global CO₂ is NOAA's annual mean at Mauna Loa; global temperature is Berkeley Earth.</p></div>
    </div>
    <h3 class="mt2">Warming stripes</h3>
    <div class="grid2" style="align-items:start">
      <div><p><b>Data.</b> The <a href="https://berkeleyearth.org/data/" target="_blank" rel="noopener">Berkeley Earth High Resolution Dataset</a> (April 2026): monthly land air-temperature anomalies on a 0.25° grid (about 25 km), CC BY-NC 4.0. We averaged each year's months, then averaged the grid cells inside each country's or region's outline, weighted by cell area. For a city we use the cell at its location, or the nearest land cell. The EU is the 27 current members together.</p>
      <p><b>Colours.</b> Following climate scientist Ed Hawkins' <a href="https://showyourstripes.info" target="_blank" rel="noopener">warming stripes</a>, blue is cooler and red warmer than the place's own 1971–2000 average, on a scale of plus or minus 2.6 standard deviations of its yearly values. A stripe's tooltip also gives the change from 1951–1980, the dataset's own reference period.</p></div>
      <div><p><b>Gaps and early years.</b> A year needs at least 8 months of data in a cell, and at least half of an area's cells must have data. Light grey stripes are years with no usable record. Before about 1880 many places had few weather stations, so the early stripes are noisy; the figure “since the 1850s” is only shown when there are at least 30 early years.</p>
      <p><b>Not shown.</b> Companies (there is no meaningful temperature for a company), 31 small countries (mostly islands), 20 small regions and 1 city that fall outside the land grid. Land temperatures warm faster than the ocean, so a country's stripes will look redder than the global average.</p></div>
    </div>
</div></section>`;

P.notes.after = (params, sub) => { if (sub === 'emissions') setTimeout(() => $('#emissions')?.scrollIntoView(), 30); };

/* ---------- GOOD NET ZERO: what the leading initiatives say (data: Net Zero Tracker comparison, 14 Nov 2024) ---------- */
const GN = window.GOODNET;
const GNS = {view:null, inst:0, open:new Set(), def:new Set()};
const LVL = {'Very high':4, 'High':3, 'Moderate':2, 'Low':1, 'Very low':0, 'N/A':-1};
const LVL_HEX = {'Very high':'#a8e8c6', 'High':'#c4efd8', 'Moderate':'#dcf6e8', 'Low':'#feeacc', 'Very low':'#fdd8b2', 'N/A':'#eeecf1'};
const PLAIN = {
  '1.5°C pathways':'Targets must match what climate science says is needed to keep warming to about 1.5°C.',
  'All emissions (Scopes 1–3)':'The target should cover the whole footprint, including supply chains and customers (Scope 3), not just direct emissions.',
  'Minimum % cut':'How deep the real cuts must be before any leftover emissions are balanced out. Usually more than 90%.',
  'Sector detail':'Whether the guidance sets different rules for different sectors, such as steel, power or farming.',
  'Interim target intervals':'How often a short-term goal should be set on the way to net zero.',
  'Sector targets for 2030':'Whether each sector gets its own target for 2030.',
  'Mitigation requirements':'Whether specific actions to cut emissions are required, not just an end goal.',
  'Fossil fuel phase-out':'Whether the plan must include ending the use of coal, oil and gas.',
  'Lobbying aligned':'Whether lobbying, including through trade associations, must support the climate target instead of undermining it.',
  'Just transition':'Whether the plan must protect the workers and communities affected by the shift.',
  'Independent verification':'Whether outside experts must check the plan and the progress.',
  'Climate contributions':'Funding climate action beyond your own operations, on top of cutting your own emissions.',
  'No offsets for interim targets':'Whether near-term targets must be met by real cuts, not by buying offsets.',
  'Residual emissions defined':'Whether the guidance says what counts as unavoidable leftover emissions.',
  'Cap on removals':'The most that can be balanced out by removing carbon, so removals cannot replace cuts.',
  'Durable storage':'Whether removed carbon must stay locked away for the long term.',
  'Permanence defined':'Whether the guidance says how long "permanent" has to be.',
};
const INST_ABBR = ['UN HLEG','ISO','Race to Zero','SBTi','NewClimate','Oxford'];
const gnRows = () => GN.sections.flatMap((s, si) => s.rows.map((r, ri) => ({...r, si, ri, sec:s, id:`gn-r${si}-${ri}`})));
function gnCat(row, c){
  const v = c.v.toLowerCase();
  if (!v || /^(not specified|not covered|not defined)/.test(v) || (row.short === 'Permanence defined' && v === 'no')) return 'none';
  if (/^(recommended|implied|indirectly|partial|varying|recommends|mostly|permanence partly)/.test(v)) return 'soft';
  return 'pos';
}
const CAT_LABEL = {pos:'Clear requirement or position', soft:'Recommended or partial', none:'Not addressed'};
const gnVal = (row, c) => `<span class="gv ${gnCat(row, c)}">${esc(c.v)}${c.star ? '<sup>*</sup>' : ''}</span>`;
const convChip = l => `<span class="cv" style="background:${LVL_HEX[l]}" title="${l}">${l}</span>`;
function gnCoverage(){
  const rows = gnRows();
  return GN.inst.map((it, j) => { const n = {pos:0, soft:0, none:0}; rows.forEach(r => n[gnCat(r, r.cells[j])]++); return {it, j, ...n}; });
}
function gnLogo(it, px = 34){ return it.logo ? `<img class="glogo" src="${esc(it.logo)}" alt="" width="${px}" height="${px}" loading="lazy" onerror="this.style.display='none'">` : ''; }

function gnAgreementMap(){
  const rows = gnRows(), cols = ['N/A','Very low','Low','Moderate','High'], rws = ['Very high','High','Moderate','Low'];
  const cell = (p, s) => rows.filter(r => r.p === p && r.s === s);
  const said = rows.filter(r => LVL[r.p] >= 3 && LVL[r.s] <= 1 && r.s !== 'N/A');
  return `<div class="amap" role="group" aria-label="Where the initiatives agree on the principle and on the specifics">
    <div class="ax-y">Agreement on the principle (the “what”)</div>
    <div class="agrid" style="grid-template-columns:92px repeat(${cols.length},minmax(0,1fr))">
      ${rws.map(p => `<div class="ah" style="background:${LVL_HEX[p]}">${p}</div>${cols.map(s => { const rs = cell(p, s), gap = LVL[p] >= 3 && LVL[s] <= 1 && s !== 'N/A'; return `<div class="ac ${gap ? 'gap' : ''}">${rs.map(r => `<button data-goto="${r.id}" title="${esc(r.name)}">${esc(r.short)}</button>`).join('')}</div>`; }).join('')}`).join('')}
      <div></div>${cols.map(s => `<div class="ah bt" style="background:${LVL_HEX[s]}">${s === 'N/A' ? 'Specifics: n/a' : s}</div>`).join('')}
    </div>
    <div class="ax-x">Agreement on the specifics (the “how”) →</div>
    <p class="foot-note" style="margin-top:8px"><span class="gapkey"></span> <b>${said.length} of ${rows.length} criteria</b> have high agreement on the principle but little on the specifics: ${said.map(r => esc(r.short.toLowerCase())).join(', ')}. In plain terms, the experts agree on <i>what</i> to do but not yet on <i>how</i> to do it.</p></div>`;
}
function gnCoverageChart(){
  const cv = gnCoverage(), n = gnRows().length;
  return `<div class="cvg">${cv.map(c => `<div class="cvrow"><div class="cvname">${gnLogo(c.it, 30)}<span><b>${esc(c.it.org)}</b><small>${esc(c.it.doc)} (${c.it.yr})</small></span></div>
    <div class="cvbar" role="img" aria-label="${esc(c.it.org)}: ${c.pos} clear, ${c.soft} partial, ${c.none} not addressed, out of ${n}">
      <i class="pos" style="width:${c.pos / n * 100}%">${c.pos || ''}</i><i class="soft" style="width:${c.soft / n * 100}%">${c.soft || ''}</i><i class="none" style="width:${c.none / n * 100}%">${c.none || ''}</i></div></div>`).join('')}
    <div class="cvkey"><span><i class="pos"></i>Clear requirement or position</span><span><i class="soft"></i>Recommended or partial</span><span><i class="none"></i>Not addressed</span></div></div>`;
}
const gnOpenCols = id => [0,1,2,3,4,5].filter(j => GNS.open.has(id + ':' + j));
const gnCard = (row, j) => { const c = row.cells[j], it = GN.inst[j];
  return `<div class="gcard" data-col="${j}"><div class="gch">${gnLogo(it, 22)}<b>${esc(it.org)}</b>${gnVal(row, c)}</div><p>${esc(c.x || 'No explanation recorded for this entry.')}</p>${c.r ? `<p class="gref">Source: ${esc(c.r)}</p>` : ''}</div>`; };
const gnDef = row => `<div class="gdef"><b>What this means.</b> ${esc(PLAIN[row.short] || '')}<br><span class="muted">${esc(row.tip || '')}</span></div>`;
const gnDetailRow = (row, open) => `<tr class="gdrow"><td colspan="${3 + GN.inst.length}"><div class="gdetail"><div class="gdefslot">${GNS.def.has(row.id) && row.tip ? gnDef(row) : ''}</div><div class="gstrip" data-row="${row.id}">${open.map(j => gnCard(row, j)).join('')}</div></div></td></tr>`;
function gnMatrix(){
  const head = `<thead><tr><th class="c1">Criterion</th><th class="cc"><span>Agree on the “what”</span></th><th class="cc"><span>Agree on the “how”</span></th>${GN.inst.map(it => `<th class="ci">${gnLogo(it, 38)}<b>${esc(it.org)}</b><small>${esc(it.doc)} (${it.yr})</small>${it.summary ? '<em>Summary of 37 guidelines</em>' : ''}</th>`).join('')}</tr></thead>`;
  const body = GN.sections.map((s, si) => `<tr class="gsec"><td class="c1"><b>${esc(s.name)}</b></td><td class="cc">${convChip(s.p)}</td><td class="cc">${convChip(s.s)}</td>${INST_ABBR.map(a => `<td class="ab">${a}</td>`).join('')}</tr>` +
    s.rows.map((r0, ri) => { const row = {...r0, si, ri, id:`gn-r${si}-${ri}`}; const open = gnOpenCols(row.id);
      return `<tr class="gcrit" id="${row.id}"><td class="c1"><button class="gname" data-def="${row.id}" aria-expanded="${GNS.def.has(row.id)}" title="What does this mean?"><span class="gi">i</span><span>${esc(row.name)}</span></button><small>${esc(PLAIN[row.short] || '')}</small></td><td class="cc">${convChip(row.p)}</td><td class="cc">${convChip(row.s)}</td>` +
        row.cells.map((c, j) => { const ex = !!c.x, on = GNS.open.has(row.id + ':' + j); return `<td class="gc"><button class="gcell ${gnCat(row, c)} ${on ? 'on' : ''}" data-cell="${row.id}:${j}" ${ex ? `aria-expanded="${on}"` : 'disabled'} title="${ex ? 'Show the explanation' : 'No explanation recorded'}">${esc(c.v)}${c.star ? '<sup>*</sup>' : ''}${ex ? '<svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>' : ''}</button></td>`; }).join('') + '</tr>' +
        (open.length || (GNS.def.has(row.id) && row.tip) ? gnDetailRow(row, open) : ''); }).join('')).join('');
  return `<div class="tablewrap gmwrap"><table class="gmx">${head}<tbody>${body}</tbody></table></div>`;
}
/* Each explanation card is centred under the cell it belongs to. When several are open in one row they
   keep their column order and slide sideways just enough to avoid overlapping. */
function gnLayout(){
  $$('.gstrip').forEach(strip => {
    const tr = document.getElementById(strip.dataset.row), cards = $$('.gcard', strip).sort((a, b) => a.dataset.col - b.dataset.col);
    if (!tr || !cards.length) { strip.style.height = '0'; return; }
    const sr = strip.getBoundingClientRect(), gap = 10, n = cards.length;
    const W = Math.max(190, Math.min(290, (sr.width - gap * (n - 1)) / n));
    const pos = cards.map(c => { const br = tr.querySelector(`[data-cell="${strip.dataset.row}:${c.dataset.col}"]`).getBoundingClientRect(); const cx = br.left + br.width / 2 - sr.left; return {c, cx, left:Math.max(0, Math.min(cx - W / 2, sr.width - W))}; });
    for (let i = 1; i < n; i++) pos[i].left = Math.max(pos[i].left, pos[i - 1].left + W + gap);
    for (let i = n - 1; i >= 0; i--) { const max = sr.width - W - (n - 1 - i) * (W + gap); if (pos[i].left > max) pos[i].left = Math.max(0, max); }
    let h = 0;
    pos.forEach(p => { p.c.style.width = W + 'px'; p.c.style.left = p.left + 'px'; p.c.style.setProperty('--ax', Math.max(16, Math.min(W - 16, p.cx - p.left)) + 'px'); });
    pos.forEach(p => { h = Math.max(h, p.c.offsetHeight); });
    strip.style.height = (h + 12) + 'px';
    requestAnimationFrame(() => pos.forEach(p => p.c.classList.remove('fresh')));
  });
}
/* update one row's explanations in place, so cards can animate instead of being rebuilt */
function gnSyncRow(id){
  const tr = document.getElementById(id), row = gnRows().find(r => r.id === id); if (!tr || !row) return;
  const open = gnOpenCols(id), hasDef = GNS.def.has(id) && row.tip;
  let dr = tr.nextElementSibling; if (dr && !dr.classList.contains('gdrow')) dr = null;
  if (!open.length && !hasDef) { if (dr) dr.remove(); }
  else {
    if (!dr) { tr.insertAdjacentHTML('afterend', gnDetailRow(row, [])); dr = tr.nextElementSibling; }
    $('.gdefslot', dr).innerHTML = hasDef ? gnDef(row) : '';
    const strip = $('.gstrip', dr);
    $$('.gcard', strip).forEach(c => { if (!open.includes(+c.dataset.col)) c.remove(); });
    open.forEach(j => { if (!strip.querySelector(`[data-col="${j}"]`)) { strip.insertAdjacentHTML('beforeend', gnCard(row, j)); strip.lastElementChild.classList.add('fresh'); } });
  }
  $$(`[data-cell^="${id}:"]`, tr).forEach(b => { const on = GNS.open.has(b.dataset.cell); b.classList.toggle('on', on); b.setAttribute('aria-expanded', on); });
  $('.gname', tr).setAttribute('aria-expanded', GNS.def.has(id));
  gnLayout();
}
function gnByInitiative(){
  const j = GNS.inst, it = GN.inst[j];
  const tabs = `<div class="tabs gtabs" role="tablist">${GN.inst.map((x, k) => `<button role="tab" data-inst="${k}" class="${k === j ? 'on' : ''}">${gnLogo(x, 22)}${esc(x.org)}</button>`).join('')}</div>`;
  return tabs + `<div class="note"><b>${esc(it.org)}: ${esc(it.doc)} (${it.yr})</b>${it.summary ? '. This column summarises a review of 37 guidelines.' : ''} ${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">Source ↗</a>` : ''}</div>` +
    GN.sections.map((s, si) => `<h3 class="mt2" style="font-size:18px">${esc(s.name)} <span class="muted" style="font-weight:500;font-size:14px">· agree on the what: ${s.p}, the how: ${s.s}</span></h3><div class="gil">${s.rows.map(r => { const c = r.cells[j], row = {...r, si}; return `<div class="gitem"><div class="gtop"><div><b>${esc(r.name)}</b><small>${esc(PLAIN[r.short] || '')}</small></div>${gnVal(row, c)}</div><div class="gconv">${convChip(r.p)}<span>the what</span>${convChip(r.s)}<span>the how</span></div>${c.x ? `<details><summary>Explanation</summary><p>${esc(c.x)}</p>${c.r ? `<p class="gref">Source: ${esc(c.r)}</p>` : ''}</details>` : ''}</div>`; }).join('')}</div>`).join('');
}
function gnRender(){
  const box = $('#gn-body'); if (!box) return;
  box.innerHTML = GNS.view === 'matrix' ? gnMatrix() : gnByInitiative();
  $$('#gn-view button').forEach(b => b.classList.toggle('on', b.dataset.v === GNS.view));
  $('#gn-bulk').hidden = GNS.view !== 'matrix';
  $$('[data-def]', box).forEach(b => b.onclick = () => { const id = b.dataset.def; GNS.def.has(id) ? GNS.def.delete(id) : GNS.def.add(id); gnSyncRow(id); });
  $$('[data-cell]', box).forEach(b => b.onclick = () => { const key = b.dataset.cell, id = key.split(':')[0]; GNS.open.has(key) ? GNS.open.delete(key) : GNS.open.add(key); gnSyncRow(id); });
  $$('[data-inst]', box).forEach(b => b.onclick = () => { GNS.inst = +b.dataset.inst; gnRender(); });
  gnLayout();
}
if (!window.__gnResize) { window.__gnResize = 1; let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if ($('.gstrip')) gnLayout(); }, 120); }); }
P.goodnet = () => {
  if (!GNS.view) GNS.view = innerWidth >= 900 ? 'matrix' : 'inst';
  const n = gnRows().length;
  return `<section class="hero" style="padding:48px 0"><div class="wrap"><p class="eyebrow" style="color:#ffb3a8">Good net zero</p><h1 style="font-size:clamp(30px,4.5vw,46px)">What should a credible net zero target include?</h1>
    <p>We compared the guidance of ${GN.inst.length - 1} leading initiatives, plus a review of 37 more, across ${n} criteria. Here is where they agree, where they don't, and exactly what each one says.</p></div></section>
  <section><div class="wrap">
    <div class="grid2 gnwide" style="gap:34px;align-items:start">
      <div><h2 class="h-brand" style="font-size:24px">Where the experts agree</h2><p class="muted mt0">Each box is a criterion, placed by how strongly the initiatives agree on the principle (up) and on the detailed specifics (across). Click one to jump to its row.</p>${gnAgreementMap()}</div>
      <div><h2 class="h-brand" style="font-size:24px">What each initiative covers</h2><p class="muted mt0">Of the ${n} criteria, how many each initiative takes a clear stance on.</p>${gnCoverageChart()}</div>
    </div>
  </div></section>
  <section class="band" id="gn-full"><div class="wrap">
    <div class="flex" style="justify-content:space-between;align-items:end"><div><h2 class="h-brand" style="font-size:26px">The full comparison</h2><p class="muted mt0" style="max-width:760px">Every criterion, rated by every initiative, in the same words as the original table. Click any entry to read the quoted explanation and its source page. Click a criterion name for a plain-English definition.</p></div>
      <div class="flex"><div class="seg" id="gn-view" role="group" aria-label="View"><button data-v="matrix">All side by side</button><button data-v="inst">One initiative at a time</button></div><button class="btn btn-ghost btn-sm" id="gn-bulk">Expand all explanations</button></div></div>
    <div class="gkey"><span><i class="gv pos">Yes</i>Clear requirement or position</span><span><i class="gv soft">Recommended</i>Recommended or partial</span><span><i class="gv none">Not specified</i>Not addressed by that initiative</span><span><b>*</b> The entry summarises a wider set of sources or a derived reading. Open it for the note.</span></div>
    <div id="gn-body" class="mt1"></div>
    <p class="foot-note">“The what” is agreement that a principle matters. “The how” is agreement on the detailed method. N/A means there are no specifics to compare. Convergence levels and wording are from the Net Zero Tracker's comparison, last updated ${esc(GN.asof)}. The Oxford Net Zero column is a summary of 37 guidelines.</p>
  </div></section>
  <section><div class="wrap grid2" style="gap:34px">
    <div><h2 class="h-brand" style="font-size:22px">What's not in this comparison yet</h2>
      <ul class="flags"><li>The SBTi column reflects its Corporate Net-Zero Standard v1.2 (March 2024). SBTi is <a href="https://sciencebasedtargets.org/developing-the-net-zero-standard" target="_blank" rel="noopener">revising it</a>.</li>
      <li>ISO is <a href="https://www.iso.org/contents/news/2024/06/netzero-standard-underway.html" target="_blank" rel="noopener">developing a full Net Zero Standard</a>. Both will be added when published, expected 2025–2026.</li>
      <li>The tracker also holds data on the <a href="https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/" target="_blank" rel="noopener">ISSB's S2 climate disclosures</a> and the Assessing Transition Plan Collective's <a href="https://assets.worldbenchmarkingalliance.org/app/uploads/2024/09/ATP-Col-guidance-and-framework-document.pdf" target="_blank" rel="noopener">framework</a>, which are in the spreadsheet only.</li></ul></div>
    <div><h2 class="h-brand" style="font-size:22px">Go deeper</h2><div class="actions" style="margin-top:0"><a class="btn btn-purple btn-sm" href="${esc(GN.xlsx)}" target="_blank" rel="noopener">Download full analysis (Excel) ↗</a><a class="btn btn-ghost btn-sm" href="https://zerotracker.net/net-zero-good-practice" target="_blank" rel="noopener">Original page ↗</a></div>
      <p class="muted mt1" style="font-size:15px">Use this to judge a target: open any country or company profile and compare its checklist with what these initiatives expect.</p></div>
  </div></section>`;
};
P.goodnet.after = () => {
  gnRender();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if ($('.gstrip')) gnLayout(); });
  $$('#gn-view button').forEach(b => b.onclick = () => { GNS.view = b.dataset.v; gnRender(); });
  $('#gn-bulk').onclick = () => { const all = gnRows(); const anyClosed = all.some(r => r.cells.some((c, j) => c.x && !GNS.open.has(r.id + ':' + j))); all.forEach(r => r.cells.forEach((c, j) => { if (c.x) anyClosed ? GNS.open.add(r.id + ':' + j) : GNS.open.delete(r.id + ':' + j); })); $('#gn-bulk').textContent = anyClosed ? 'Collapse all explanations' : 'Expand all explanations'; gnRender(); };
  $$('[data-goto]').forEach(b => b.onclick = () => { GNS.view = 'matrix'; gnRender(); const el = document.getElementById(b.dataset.goto); if (el) { el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } });
};

/* ---------- FAQS + ABOUT ---------- */
const FQ = window.FAQ;
P.faqs = () => {
  const counts = ['country','region','city','company'].map(t => `<div><b>${fmt(D.filter(e => e.t === t).length)}</b><span>${TYPE[t][1].toLowerCase()}</span></div>`).join('');
  return `
  <section class="hero" style="padding:48px 0"><div class="wrap"><p class="eyebrow" style="color:#ffb3a8">FAQs</p><h1 style="font-size:clamp(30px,4.5vw,46px)">Frequently asked questions</h1><p>What the Tracker is, what it covers, where the data comes from, and how to correct it.</p></div></section>
  <section class="tight"><div class="wrap faqwrap">
    <div class="faqbar">
      <label class="sr" for="faq-q">Search the questions</label>
      <input id="faq-q" type="search" placeholder="Search the questions, for example “offsets” or “update”" autocomplete="off">
      <div class="faqchips" role="group" aria-label="Topics"><button class="on" data-c="">All</button>${FQ.map(c => `<button data-c="${esc(c.cat)}">${esc(c.cat)}</button>`).join('')}</div>
      <div class="faqmeta"><span id="faq-n"></span><button class="linkbtn" id="faq-all">Expand all</button></div>
    </div>
    <div id="faq-list">${FQ.map(c => `<div class="faqcat" data-c="${esc(c.cat)}"><h2>${esc(c.cat)}</h2>${c.items.map(it => `<details class="faqitem"><summary>${esc(it.q)}</summary><div class="faqa">${it.a}${it.q.startsWith('What entities') ? `<div class="faqcounts"><span class="muted">In this prototype's data today:</span>${counts}</div>` : ''}</div></details>`).join('')}</div>`).join('')}</div>
    <p id="faq-none" class="empty" hidden>No question matches. Try a shorter word, or <a href="#/about">contact the team</a>.</p>
    <div class="card faqmore"><div><h3>Didn't find your answer?</h3><p>To report a data error or suggest an update, use the form. For anything else, email the team.</p></div><div class="flex"><a class="btn btn-red btn-sm" href="https://form.typeform.com/to/ZyfGb9tZ" target="_blank" rel="noopener">Suggest an update</a><a class="btn btn-ghost btn-sm" href="#/about">About &amp; contact</a></div></div>
  </div></section>`;
};
P.faqs.after = () => {
  const q = $('#faq-q'); let cat = '';
  const apply = () => { const w = q.value.trim().toLowerCase(); let n = 0;
    $$('.faqcat').forEach(c => { let any = 0;
      $$('.faqitem', c).forEach(d => { const ok = (!cat || c.dataset.c === cat) && (!w || d.textContent.toLowerCase().includes(w)); d.hidden = !ok; if (ok) { any++; n++; } });
      c.hidden = !any; });
    $('#faq-n').textContent = n + (n === 1 ? ' question' : ' questions'); $('#faq-none').hidden = n > 0; };
  q.addEventListener('input', apply);
  $$('.faqchips button').forEach(b => b.onclick = () => { cat = b.dataset.c; $$('.faqchips button').forEach(x => x.classList.toggle('on', x === b)); apply(); });
  $('#faq-all').onclick = () => { const ds = $$('.faqitem:not([hidden])'); const open = ds.some(d => !d.open); ds.forEach(d => d.open = open); $('#faq-all').textContent = open ? 'Collapse all' : 'Expand all'; };
  apply();
};
const PARTNERS = [
  ['ECIU', 'Energy & Climate Intelligence Unit', 'https://eciu.net/', 'img/eciu.svg', 46, 'A non-profit organisation supporting informed debate on energy and climate change issues in the UK. Britain faces important choices on energy and on responding to climate change, and ECIU believes it is vital that debates on these issues are underpinned by evidence and set in their proper context.'],
  ['DDL', 'Data-Driven EnviroLab', 'https://datadrivenlab.org/', 'img/dde.svg', 58, 'An interdisciplinary research lab headed by Dr. Angel Hsu and based at the University of North Carolina-Chapel Hill. DDL uses innovative data analytics, AI and machine learning processes, and large-scale and unconventional datasets to develop solutions to contemporary environmental problems and strengthen environmental policymaking across all levels.'],
  ['NewClimate', 'NewClimate Institute', 'https://newclimate.org/', 'img/nci.svg', 54, 'A non-profit institute established in 2014. It supports research and implementation of action against climate change around the globe, covering international climate negotiations, tracking climate action, climate and development, climate finance and carbon market mechanisms. It aims at connecting up-to-date research with the real world decision making processes.'],
  ['Oxford', 'Oxford Net Zero', 'https://netzeroclimate.org/', 'img/ox.svg', 62, 'An interdisciplinary research initiative based at the University of Oxford, building on fifteen years of research on climate neutrality. As a network of leading researchers, it provides advice and expertise in the global race to net zero by national governments, global industry leaders and international organisations.']
];
P.about = () => `
  <section class="hero" style="padding:48px 0"><div class="wrap"><p class="eyebrow" style="color:#ffb3a8">About &amp; contact</p><h1 style="font-size:clamp(30px,4.5vw,46px)">Transparency and accountability on net zero</h1><p>The only independent tool that gives a comprehensive view of net zero across all nations and the world's largest regions, cities and companies.</p></div></section>
  <section><div class="wrap grid2" style="align-items:start">
    <div><h2 class="h-brand">What we do</h2>
      <p class="lede">We collect data on (i) targets set and (ii) the factors that show whether those targets are robust: essentially, how serious companies and governments are about meaningfully cutting their net emissions to zero.</p>
      <p>You can investigate specific entities, sectors or regions, take a global snapshot that is accurate at that moment, or evaluate progress over time. The Data Explorer is a simple way to interrogate the data by entity type, region and integrity marker. The Tracker follows more of the UN Expert Group (HLEG) recommendations than any other initiative, and plans to align more closely still.</p>
      <div class="flex mt2"><a class="btn btn-purple btn-sm" href="#/explore">Explore the data</a><a class="btn btn-ghost btn-sm" href="#/learn/method">How we assess targets</a></div></div>
    <div class="grid2" style="gap:16px">
      <div class="card" style="border-top:5px solid var(--red)"><h3>Why</h3><p>The Tracker was born of necessity. Net zero targets have multiplied, especially after the IPCC Special Report on 1.5°C (2018), but accountability and transparency have not kept up. Stakeholders cannot tell targets backed by robust plans from mere rhetoric.</p></div>
      <div class="card" style="border-top:5px solid var(--green)"><h3>Our mission</h3><p>To create the definitive global resource for collating, assessing and presenting the scale and quality of net zero pledges across nations, sub-nationals, companies and other entities.</p></div>
    </div>
  </div></section>
  <section class="band"><div class="wrap">
    <div class="center"><h2 class="h-brand">Net Zero Tracker partners</h2><p class="lede">A collaboration between four organisations.</p></div>
    <div class="grid2 mt2">${PARTNERS.map(p => `<a class="card partner" href="${p[2]}" target="_blank" rel="noopener"><span class="plogo"><img src="${p[3]}" alt="" style="height:${Math.min(p[4], 52)}px"></span><span><h3>${esc(p[1])} ↗</h3><p>${esc(p[5])}</p></span></a>`).join('')}</div>
  </div></section>
  <section><div class="wrap grid2" style="align-items:start">
    <div><h2 class="h-brand">Acknowledgements</h2>
      <p>Funding is entirely provided by philanthropic foundations. The Net Zero Tracker is generously backed by the <b>IKEA Foundation</b>, the <b>European Climate Foundation (ECF)</b> and <b>ClimateWorks Foundation</b>.</p>
      <p>The team owes a huge debt of gratitude to all Net Zero Tracker volunteers, whose names are in the <a href="https://zerotracker.net/methodology" target="_blank" rel="noopener">methodology</a>.</p></div>
    <div><h2 class="h-brand">Supporting partners</h2>
      <ul class="flags plain">
        <li><b>Arboretica</b> (James Zhang and team): open-source intelligence tools and semantic algorithms that, with DDL, help connect fragmented public data from all over the world.</li>
        <li><b>Climate Policy Radar</b>: a fellow initiative dedicated to tracking, organising and enabling credible analysis of disparate climate data. The two work closely together.</li>
        <li><b>HICARI Project</b> (Hub of Intelligence for Climate Action, Resilience and Integrity): a research project at the Institute for Future Initiatives, University of Tokyo, informing Japan's net-zero transition by 2050.</li>
      </ul></div>
  </div></section>
  <section class="band" id="contact"><div class="wrap">
    <div class="center"><h2 class="h-brand">Contact</h2><p class="lede">The team wants to hear from you, especially in these early stages.</p></div>
    <div class="grid3 mt2">
      <div class="card"><h3>Report an error or add information</h3><p>To flag a data inaccuracy or add information that gives a fuller picture of an entity, use the form.</p><a class="btn btn-red btn-sm" href="https://form.typeform.com/to/ZyfGb9tZ" target="_blank" rel="noopener">Suggest an update</a></div>
      <div class="card"><h3>Questions about updates</h3><p>If you have questions about the update process, email the team.</p><a class="btn btn-ghost btn-sm" href="mailto:updates@zerotracker.net">updates@zerotracker.net</a></div>
      <div class="card"><h3>Everything else</h3><p>Feedback, press and general enquiries.</p><a class="btn btn-ghost btn-sm" href="mailto:hello@zerotracker.net">hello@zerotracker.net</a></div>
    </div>
    <p class="center muted mt2">Looking for quick answers first? <a href="#/faqs">Read the FAQs</a>.</p>
  </div></section>`;


/* ---------- MORE PAGES (rebuilt from the live site: analysis, insights, news, methodology, volunteering, team, terms) ---------- */
const NZP = window.NZP || {};
const fdate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '';
const pageHero = (eyebrow, title, lede) => `<section class="hero" style="padding:48px 0"><div class="wrap"><p class="eyebrow" style="color:#ffb3a8">${esc(eyebrow)}</p><h1 style="font-size:clamp(30px,4.5vw,46px)">${esc(title)}</h1>${lede ? `<p>${esc(lede)}</p>` : ''}</div></section>`;
function listPage(eyebrow, title, lede, items, kinds){
  const ks = kinds ? [...new Set(items.map(i => i.k).filter(Boolean))] : [];
  return pageHero(eyebrow, title, lede) + `<section class="tight"><div class="wrap">
    <div class="lpbar"><input type="search" id="lp-q" placeholder="Search…" aria-label="Search"/>${ks.length ? `<div class="chips" id="lp-k"><button class="on" data-k="">All</button>${ks.map(k => `<button data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}</div>
    <p class="muted" id="lp-n" style="margin:6px 0 0;font-size:14px"></p>
    <div class="alist" id="lp-list">${items.map(i => { const body = `${i.img ? `<img class="th" src="${esc(i.img)}" alt="" loading="lazy">` : ''}<div class="tx"><div class="meta">${esc(fdate(i.d))}${i.k ? ' · ' + esc(i.k) : ''}${i.src ? ' · ' + esc(i.src) : ''}</div><h3>${esc(i.t)}${i.u ? ' ↗' : ''}</h3>${i.s ? `<p>${esc(i.s)}</p>` : ''}</div>`; const q = esc((i.t + ' ' + (i.s || '') + ' ' + (i.src || '') + ' ' + (i.k || '')).toLowerCase()); return i.u ? `<a class="aitem" href="${esc(i.u)}" target="_blank" rel="noopener" data-q="${q}" data-k="${esc(i.k || '')}">${body}</a>` : `<div class="aitem" data-q="${q}" data-k="${esc(i.k || '')}">${body}</div>`; }).join('')}</div>
    <p class="muted mt2" style="font-size:14.5px">Items open on zerotracker.net, where the full articles live.</p>
  </div></section>`;
}
function listWire(){
  const q = $('#lp-q'); if (!q) return; let k = '';
  const run = () => { const t = q.value.trim().toLowerCase(); let n = 0; $$('#lp-list .aitem').forEach(a => { const ok = (!t || a.dataset.q.includes(t)) && (!k || a.dataset.k === k); a.hidden = !ok; if (ok) n++; }); $('#lp-n').textContent = n + ' shown'; };
  q.oninput = run; $$('#lp-k button').forEach(b => b.onclick = () => { k = b.dataset.k; $$('#lp-k button').forEach(x => x.classList.toggle('on', x === b)); run(); }); run();
}
P.analysis = () => listPage('Analysis', 'Analysis', 'Our latest on the quality of net zero targets across nations, regions, cities and the world’s largest companies.', NZP.analysis || []);
P.analysis.after = listWire;
P.insights = () => listPage('Insights', 'Insights', 'The Net Zero Tracker team’s latest commentary and explainers on everything net zero.', NZP.insights || [], true);
P.insights.after = listWire;
P.news = () => listPage('In the news', 'In the news', 'Net Zero Tracker events and news highlights.', NZP.news || []);
P.news.after = listWire;
P.methodology = () => pageHero('Methodology', 'Methodology', (NZP.methodology || {}).sum || 'How the Net Zero Tracker collects, assesses and cites its data.') + `<section class="tight"><div class="wrap"><div class="prose">${((NZP.methodology || {}).html || '').replace(/<ul>(?:(?!<\/ul>)[\s\S])*<\/ul>/g, m => (m.match(/<li>/g) || []).length > 40 ? m.replace('<ul>', '<ul class="names">') : m)}</div>
  <div class="note mt2">The prototype’s plain-language checklist is explained on <a href="#/learn/method">How we assess targets</a>.</div></div></section>`;
P.terms = () => pageHero('Legal', 'Terms and conditions', '') + `<section class="tight"><div class="wrap"><div class="prose">${NZP.terms || ''}</div></div></section>`;
P['data-terms'] = () => pageHero('Data', 'Data and terms of use', 'How you can use Net Zero Tracker data.') + `<section class="tight"><div class="wrap"><div class="prose">${NZP.dtou || ''}</div></div></section>`;
P.volunteering = () => { const v = NZP.vol || {}; return pageHero('Volunteering', 'Volunteer hub', v.intro) + `<section><div class="wrap">
  <div class="flex"><a class="btn btn-red" href="${esc(v.signup)}" target="_blank" rel="noopener">Sign up now</a></div>
  <div class="grid2 mt2">${(v.links || []).map(l => `<a class="vcard" href="${esc(l.u)}"${l.u.startsWith('http') ? ' target="_blank" rel="noopener"' : ' onclick="document.getElementById(\'vol-why\').scrollIntoView();return false"'}>${l.img ? `<img src="${esc(l.img)}" alt="" loading="lazy">` : ''}<h3>${esc(l.t)}</h3><p>${esc(l.s)}</p></a>`).join('')}</div>
  <h2 class="h-brand mt3" id="vol-why">Why volunteer with the Net Zero Tracker?</h2>
  <div class="grid3 mt2">${(v.articles || []).map(a => `<a class="vcard" href="${esc(a.u)}" target="_blank" rel="noopener">${a.img ? `<img src="${esc(a.img)}" alt="" loading="lazy">` : ''}<h3>${esc(a.t)} ↗</h3><p>${esc(a.s)}</p></a>`).join('')}</div>
  <div class="grid2 mt2">${(v.quotes || []).map(q => `<div class="card" style="border-top:5px solid var(--green)"><p style="margin:0">“${esc(q.replace(/\s+[–-]\s+[^–-]+$/, '').replace(/^["“]|["”]$/g, ''))}”</p><p class="muted" style="margin:.6em 0 0;font-size:14.5px">${esc((q.match(/[–-]\s+([^–-]+)$/) || [, ''])[1])}</p></div>`).join('')}</div>
  <div class="card mt2" style="background:var(--band)"><h3>Volunteer newsletter</h3><p>Want to learn more about net zero, events and what’s happening at the Tracker? Join the bi-weekly volunteer newsletter.</p><a class="btn btn-purple btn-sm" href="${esc(v.news)}" target="_blank" rel="noopener">Subscribe</a></div>
  </div></section>`; };
P.team = () => { const t = NZP.team || [], ini = n => n.replace(/^Dr\.\s*/, '').split(' ').map(x => x[0]).slice(0, 2).join('');
  const card = m => `<article class="tcard"><div class="tph" tabindex="0" aria-label="${esc(m.n)}: show biography">${m.img ? `<img src="${esc(m.img)}" alt="${esc(m.n)}" loading="lazy">` : `<div class="av2" aria-hidden="true">${esc(ini(m.n))}</div>`}<div class="tbio">${m.s}</div></div>
    <div class="tinfo"><h3>${esc(m.n)}</h3><p class="job">${esc(m.j)}</p><p class="soc">${m.em ? `<a href="mailto:${esc(m.em)}" aria-label="Email ${esc(m.n)}" title="${esc(m.em)}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></a>` : ''}${m.li ? `<a href="${esc(m.li)}" target="_blank" rel="noopener" aria-label="${esc(m.n)} on LinkedIn" title="LinkedIn"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M20.4 20.5h-3.600v-5.600c0-1.300 0-3-1.800-3s-2.100 1.400-2.100 2.900v5.700H9.300V9h3.400v1.600h.1c.5-.9 1.600-1.800 3.400-1.800 3.600 0 4.300 2.400 4.300 5.500v6.200zM5.300 7.400a2.100 2.100 0 1 1 0-4.200 2.100 2.100 0 0 1 0 4.200zM7.100 20.500H3.600V9h3.500v11.500z"/></svg></a>` : ''}${m.bs ? `<a href="${esc(m.bs)}" target="_blank" rel="noopener" aria-label="${esc(m.n)} on Bluesky" title="Bluesky"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"/></svg></a>` : ''}</p></div></article>`;
  return pageHero('The team', 'The team', 'The team is drawn from the Net Zero Tracker’s four partner organisations, all experts in their fields.') + `<section><div class="wrap">
  <p class="muted" style="margin-top:0">Hover over a photo (or tap it) to read the biography.</p>
  <div class="grid3 tgrid">${t.slice(0, 7).map(card).join('')}</div>
  <h2 class="h-brand mt3">Partner leads</h2><div class="grid3 tgrid mt1">${t.slice(7).map(card).join('')}</div></div></section>`; };
/* ---------- router ---------- */
function route(){
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?'); const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  let page = parts[0] || 'home', arg = parts[1];
  if (page === 'e') page = 'entity';
  if (page === 'activists') { location.replace('#/advocates'); return; }  // old link
  if (!P[page]) page = 'home';
  hideTip();
  $('#main').innerHTML = P[page](params, arg);
  $$('#nav a[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === page));
  $('#nav').classList.remove('open');
  document.title = (page === 'entity' && BY[arg] ? BY[arg].n + ' | ' : page !== 'home' ? ({explore:'Explore',compare:'Compare',learn:'Learn',goodnet:'Good net zero',analysis:'Analysis',insights:'Insights',news:'In the news',methodology:'Methodology',volunteering:'Volunteering',team:'The team',terms:'Terms and conditions','data-terms':'Data and terms of use',policymakers:'For policymakers',advocates:'For advocates',notes:'About this prototype',faqs:'FAQs',about:'About & contact'}[page] + ' | ') : '') + 'Net Zero Tracker (prototype)';
  if (P[page].after) P[page].after(params, arg);
  if (!((page === 'learn' || page === 'notes') && arg)) window.scrollTo(0, 0);
}
const asof = (META.source || '').match(/(\d{4})-(\d{2})/); if (asof) $('#asof').textContent = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+asof[2]-1] + ' ' + asof[1];
addEventListener('hashchange', route);
route();
})();
