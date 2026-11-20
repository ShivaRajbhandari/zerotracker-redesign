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
const BY = Object.fromEntries(D.map(e => [e.s, e]));
D.forEach(e => { if (e.rev >= 1e12) { e.revBad = e.rev; delete e.rev; } }); // data issue in the source: see the notes page
const THE = /^(United |Netherlands|Philippines|Bahamas|Gambia|Maldives|Marshall Islands|Solomon Islands|Comoros|Seychelles|Czech Republic|Dominican Republic|Central African Republic|Dem\. Rep\.|Republic of|European Union)/;
const nm = e => (e.t === 'country' && THE.test(e.n) ? 'the ' : '') + e.n;
const Nm = e => { const s = nm(e); return s[0].toUpperCase() + s.slice(1); };

/* ---------- vocabulary: plain language ---------- */
const NZ_TYPES = new Set(['Net zero','Carbon neutral(ity)','Climate neutral','GHG neutral(ity)','Zero emissions','Zero carbon','Net negative','Carbon negative','Climate positive']);
const isNZ = e => NZ_TYPES.has(e.e);
const hasAnyTarget = e => e.e && e.e !== 'No target';
const year = e => { const y = +e.y; return y >= 2000 ? y : null; };
const iyear = e => { const y = +e.iy; return y >= 2000 ? y : null; };
const TYPE = {country:['Country','Countries'], region:['Region','Regions'], city:['City','Cities'], company:['Company','Companies']};
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
const typeBadge = t => `<span class="badge ${t}">${TYPE[t][0]}</span>`;
const where = e => e.t === 'country' ? (e.g || '') : [e.cn, e.t==='company' && e.sec ? e.sec : null].filter(Boolean).join(' · ');
const official = e => `https://zerotracker.net/${TYPE_PATH[e.t]}/${e.s}`;
const money = n => n >= 1e12 ? '$' + (n/1e12).toFixed(1) + 'tn' : n >= 1e9 ? '$' + Math.round(n/1e9) + 'bn' : n >= 1e6 ? '$' + Math.round(n/1e6) + 'm' : '$' + fmt(n);
const people = n => n >= 1e9 ? (n/1e9).toFixed(2) + ' billion' : n >= 1e6 ? (n/1e6).toFixed(1) + ' million' : fmt(Math.round(n));

/* ---------- helpers ---------- */
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 2200); }
function copy(text){ (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Copied to clipboard'), () => toast('Select and copy the text manually')); }
window.toggleMenu = btn => { const n = $('#nav'); n.classList.toggle('open'); btn.setAttribute('aria-expanded', n.classList.contains('open')); };
const tip = $('#tip');
function showTip(html, ev){ tip.innerHTML = html; tip.style.display = 'block'; moveTip(ev); }
function moveTip(ev){ const w = tip.offsetWidth, h = tip.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
function hideTip(){ tip.style.display = 'none'; }
const compareSet = { get(){ try { return JSON.parse(localStorage.getItem('nzt-cmp') || '[]').filter(s => BY[s]); } catch(e) { return this._m || []; } },
  set(a){ this._m = a; try { localStorage.setItem('nzt-cmp', JSON.stringify(a)); } catch(e){} } };

/* ---------- search box ---------- */
const SEARCH = D.map(e => ({e, k:(e.n + ' ' + (e.cn||'')).toLowerCase()}));
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
    res = SEARCH.filter(x => x.k.includes(q) && (!filter || filter(x.e))).sort((a,b) => (b.e.n.toLowerCase().startsWith(q)) - (a.e.n.toLowerCase().startsWith(q)) || ['country','region','city','company'].indexOf(a.e.t) - ['country','region','city','company'].indexOf(b.e.t)).slice(0, 9).map(x => x.e);
    sg.innerHTML = res.length ? res.map((e,i) => `<a href="#/e/${e.s}" data-i="${i}">${typeBadge(e.t)}<span>${esc(e.n)}</span><small>${esc(targetPhrase(e))}</small></a>`).join('') : '<div class="empty" style="padding:14px">No match. Try a country, city, region or company name.</div>';
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
      <a class="card path" href="#/activists"><span class="who">Advocates &amp; campaigners</span><h3>Hold a target to account</h3><ul><li>Spot the six warning signs of a weak pledge</li><li>Get questions to put to a company or council</li><li>Cite the data correctly</li></ul><span class="go">Advocate toolkit →</span></a>
      <a class="card path" href="#/compare"><span class="who">Journalists &amp; researchers</span><h3>Compare and download</h3><ul><li>Put up to 4 entries side by side</li><li>Filter and export any list as CSV</li><li>Link every claim to its source</li></ul><span class="go">Compare tool →</span></a>
    </div>
  </div></section>

  <section class="band"><div class="wrap">
    <div class="center"><h2 class="h-brand">What makes a good net zero target?</h2><p class="lede">We ask four questions of every target. Each profile answers them in plain language.</p></div>
    <div class="grid4 mt2">${pillarCards()}</div>
    <p class="center mt2"><a class="btn btn-purple" href="#/learn">Net zero explained in 2 minutes</a></p>
  </div></section>`;
};
P.home.after = () => { wireSearch('s-home'); drawMap('m-home'); drawCompanies('c-home'); };
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
  return `<b>${e.t === 'country' ? flag(e.a2) + ' ' : ''}${esc(e.n)}</b> <span class="k">${TYPE[e.t][0]}${loc}</span><br>${esc(targetPhrase(e))}<br><span class="k">Commitment:</span> ${esc(level(e).label)}${isNZ(e) ? `<br><span class="k">Credibility checks met:</span> ${t.yes} of ${cs.length}` : ''}<br><span class="k" style="font-size:12.5px">Click for the full profile</span>`;
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
  const W = 960, H = 500;
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
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="World map of net zero targets for countries, regions and cities. The same information is in the tables below.">
      <g class="zoomer"><g class="L-base">${cp.map(d => `<path class="base" d="${d}"></path>`).join('')}</g><g class="L-country">${cf.map((f, i) => { const e = byIso[f.id]; return `<path class="land c" d="${cp[i]}"${e ? ` data-s="${e.s}"` : ' fill="#ececec"'}></path>`; }).join('')}</g>
      <g class="L-region">${rf.map(f => `<path class="land r" d="${path(f)}" data-s="${f.properties.s}"></path>`).join('')}</g>
      <g class="L-city">${pins.map(p => `<circle class="pin" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.4" data-s="${p.e.s}"></circle>`).join('')}</g></g>
    </svg></div>
    <p class="foot-note">Drag to move the map. Zoom with the + and − buttons, or hold Ctrl or ⌘ and scroll. Cities show as dots, regions as outlined areas. ${fmt(722 - st.n.region)} regions and ${fmt(1185 - st.n.city)} city cannot be placed on the map yet, but they are in the tables.</p></div>`;
  const svgEl = $('svg', box), svg = d3.select(svgEl), gz = svg.select('g.zoomer'); let k = 1;
  const zoom = d3.zoom().scaleExtent([1, 16]).translateExtent([[0,0],[W,H]]).extent([[0,0],[W,H]])
    .filter(ev => ev.type === 'wheel' ? (ev.ctrlKey || ev.metaKey) : ev.type.startsWith('touch') ? (k > 1 || (ev.touches && ev.touches.length > 1)) : !ev.button)
    .on('zoom', ev => { k = ev.transform.k; gz.attr('transform', ev.transform); gz.selectAll('circle.pin').attr('r', Math.max(1.5, 3.6 / Math.pow(k, 0.62))); });
  svg.call(zoom); svgEl.style.touchAction = 'pan-y pinch-zoom';
  $$('[data-z]', box).forEach(b => b.onclick = () => { const a = b.dataset.z; svg.transition().duration(220).call(a === 'reset' ? zoom.transform : zoom.scaleBy, a === 'reset' ? d3.zoomIdentity : (a === 'in' ? 1.7 : 1 / 1.7)); });
  svgEl.addEventListener('mousemove', ev => { const el = ev.target.closest('[data-s]'); if (!el) return hideTip(); showTip(tipHtml(BY[el.dataset.s]), ev); });
  svgEl.addEventListener('mouseleave', hideTip);
  svgEl.addEventListener('click', ev => { const el = ev.target.closest('[data-s]'); if (el) { hideTip(); location.hash = '#/e/' + el.dataset.s; } });
  paint(st);
}

/* ---------- COMPANY TREEMAP ---------- */
async function drawCompanies(id){
  const box = $('#' + id); if (!box) return;
  if (!window.d3) { box.innerHTML = '<div class="empty">The chart library did not load. The table has the same data.</div>'; return; }
  const ents = universe('company');
  const st = VZ[id] = {id, kind:'co', mode:'status', size:'rev', hl:null, counts:{}, ents};
  box.innerHTML = `<aside class="vpanel"></aside><div class="vmain"><div class="mapbox"><svg viewBox="0 0 960 560" role="img" aria-label="Treemap of the world's largest public companies, grouped by sector. Each box is a company. The table below has the same data."></svg></div><p class="foot-note" id="${id}-cap"></p></div>`;
  const svgEl = $('svg', box);
  svgEl.addEventListener('mousemove', ev => { const el = ev.target.closest('[data-s]'); if (!el) return hideTip(); showTip(tipHtml(BY[el.dataset.s]) , ev); });
  svgEl.addEventListener('mouseleave', hideTip);
  svgEl.addEventListener('click', ev => { const el = ev.target.closest('[data-s]'); if (el) { hideTip(); location.hash = '#/e/' + el.dataset.s; } });
  const revAll = ents.reduce((s, e) => s + (e.rev || 0), 0), revNZ = ents.filter(isNZ).reduce((s, e) => s + (e.rev || 0), 0);
  $('#' + id + '-cap').innerHTML = `Each box is one company, grouped by sector. <b>${pct(ents.filter(isNZ).length, ents.length)}%</b> of these ${fmt(ents.length)} public companies have a net zero target, and together they earn <b>${pct(revNZ, revAll)}%</b> of the group's combined revenue. Companies with no revenue figure are drawn small.`;
  drawTreemap(st);
}
function drawTreemap(st){
  const svgEl = $('#' + st.id + ' svg'); if (!svgEl) return;
  const W = 960, H = 560, bySec = new Map();
  st.ents.forEach(e => { const s = e.sec && e.sec !== 'NA' ? e.sec : 'Other / unclassified'; if (!bySec.has(s)) bySec.set(s, []); bySec.get(s).push(e); });
  const root = d3.hierarchy({children:[...bySec].map(([name, c]) => ({name, children:c}))}).sum(d => d.s ? (st.size === 'rev' ? Math.max(d.rev || 0, 2e8) : 1) : 0).sort((a, b) => b.value - a.value);
  d3.treemap().size([W, H]).paddingOuter(3).paddingTop(d => d.depth === 1 ? 19 : 0).paddingInner(1).round(true)(root);
  const short = (t, w, px) => { const n = Math.floor(w / px); return t.length > n ? t.slice(0, Math.max(n - 1, 0)).trim() + '…' : t; };
  svgEl.innerHTML = root.children.map(g => `<g><text x="${g.x0 + 3}" y="${g.y0 + 14}" class="tg">${esc(short(g.data.name.toUpperCase(), g.x1 - g.x0 - 6, 7.6))}</text>${g.children.map(c => {
    const w = c.x1 - c.x0, h = c.y1 - c.y0, e = c.data;
    return `<rect x="${c.x0}" y="${c.y0}" width="${w}" height="${h}" data-s="${e.s}"></rect>`; }).join('')}</g>`).join('') +
    root.leaves().map(c => { const w = c.x1 - c.x0, h = c.y1 - c.y0; return w > 62 && h > 20 ? `<text class="tl" data-for="${c.data.s}" x="${c.x0 + 4}" y="${c.y0 + 14}">${esc(short(c.data.n, w - 8, 6.6))}</text>` : ''; }).join('');
  paint(st);
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
    <div class="seg mt2" id="ex-view" role="group" aria-label="What to show"><button data-v="gov" class="${EX.type==='company' ? '' : 'on'}"><b>Governments</b><span>Countries, regions and cities on a map</span></button><button data-v="co" class="${EX.type==='company' ? 'on' : ''}"><b>Companies</b><span>The largest companies, one box each</span></button></div>
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
  </div></section>`;
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
  let xs = byType(EX.type).filter(e => (!q || (e.n + ' ' + (e.cn||'')).toLowerCase().includes(q)) && (!EX.g || e.g === EX.g) && (!EX.nz || isNZ(e)) && (!EX.st || String(level(e).k) === EX.st) && (!EX.sec || e.sec === EX.sec));
  const key = {name:e => e.n.toLowerCase(), where:e => (where(e)||'').toLowerCase(), target:e => isNZ(e) ? (year(e) || 9999) : 99999, level:e => -level(e).k, interim:e => iyear(e) || 9999, score:e => -(isNZ(e) ? tally(checks(e)).yes : -1), size:e => -(e.rev || e.pop || 0)}[EX.sort];
  return xs.sort((a,b) => { const A = key(a), B = key(b); return (A < B ? -1 : A > B ? 1 : 0) * EX.dir; });
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
  const W = 900, x = v => 30 + (v - start) / (end - start) * (W - 60);
  const ticks = []; for (let t = 2020; t <= end; t += 10) ticks.push(t);
  const mk = (v, lab, sub, col, up) => `<g><line x1="${x(v)}" x2="${x(v)}" y1="${up?40:60}" y2="${up?60:80}" stroke="${col}" stroke-width="2"/><circle cx="${x(v)}" cy="60" r="8" fill="${col}" stroke="#fff" stroke-width="3"/><text x="${x(v)}" y="${up?22:104}" text-anchor="middle" font-size="15" font-weight="700" fill="${col}">${lab}</text><text x="${x(v)}" y="${up?36:120}" text-anchor="middle" font-size="12.5" fill="#5f5869">${sub}</text></g>`;
  return `<svg viewBox="0 0 ${W} 130" role="img" aria-label="Timeline: today ${NOW}${iy ? ', milestone ' + iy : ''}${y ? ', target ' + y : ''}">
    <line x1="${x(start)}" x2="${x(end)}" y1="60" y2="60" stroke="#dcdcdc" stroke-width="6" stroke-linecap="round"/>
    ${y && isNZ(e) ? `<line x1="${x(NOW)}" x2="${x(y)}" y1="60" y2="60" stroke="#b2d49b" stroke-width="6" stroke-linecap="round"/>` : ''}
    ${ticks.map(t => `<text x="${x(t)}" y="${y && Math.abs(t-y)<4 || iy && Math.abs(t-iy)<4 || Math.abs(t-NOW)<4 ? -100 : 66+28}" text-anchor="middle" font-size="12" fill="#9a94a3">${t}</text>`).join('')}
    ${mk(NOW, 'Today', String(NOW), '#271039', true)}
    ${iy && iy >= start ? mk(iy, 'Milestone ' + iy, e.ip ? e.ip + '% cut' : 'interim target', '#c27a00', false) : ''}
    ${y && hasAnyTarget(e) ? mk(y, (isNZ(e) ? 'Net zero ' : 'Target ') + y, y > NOW ? (y - NOW) + ' years away' : 'target year', '#3B7CC3', true) : ''}
  </svg>`;
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
  if (e.t === 'country') return [['region','Region'],['world','World'],['size','Similar population']];
  return [['region','Region'],['country','Same country'],['world','World'],['size','Similar size']];
}
function peerMode(e){
  const ms = peerModes(e).map(m => m[0]);
  const want = PM[e.t] && ms.includes(PM[e.t]) ? PM[e.t] : ms[0];
  return want;
}
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
  else if (mode === 'size') {
    const v = e[key] || 0, N = 25;
    xs = pool.filter(x => x[key] > 0).sort((a, b) => Math.abs(Math.log(a[key] / v)) - Math.abs(Math.log(b[key] / v))).slice(0, N);
    const lo = Math.min(...xs.map(x => x[key])), hi = Math.max(...xs.map(x => x[key]));
    const rng = key === 'rev' ? `${money(lo)} to ${money(hi)} in annual revenue` : `${people(lo)} to ${people(hi)} people`;
    label = `${T} closest in ${key === 'rev' ? 'revenue' : e.t === 'city' ? 'size' : 'population'} (${rng})`;
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
    <div class="crumbs"><a href="#/">Home</a> › <a href="#/explore?type=${e.t}">${TYPE[e.t][1]}</a>${e.t!=='country' && e.cn ? ` › ${(() => { const c = D.find(x => x.t==='country' && x.c===e.c); return c ? `<a href="#/e/${c.s}">${esc(e.cn)}</a>` : esc(e.cn); })()}` : ''}</div>
    <div class="ptop"><div>${typeBadge(e.t)}
      <h1>${e.t==='country' ? `<span class="flag">${flag(e.a2)}</span>` : ''}${esc(e.n)}</h1>
      <div class="facts">${facts.map(([k,v]) => `<span>${k}: <b>${esc(v)}</b></span>`).join('')}</div></div>
      <div class="yr"><div class="n">${isNZ(e) && y ? y : hasAnyTarget(e) && y ? y : '—'}</div><small>${isNZ(e) ? 'Net zero target year' : hasAnyTarget(e) ? 'Target year (not net zero)' : 'No target year'}</small></div>
    </div>
  </div></div>

  <section class="tight"><div class="wrap">
    <p class="eyebrow">The short version</p>
    <p class="summary">${summaryText(e)}</p>
    ${isNZ(e) ? `<div class="verdict"><div class="ring">${ring}<div class="t"><span>${t.yes}/${n}<small>checks met</small></span></div></div>
      <div class="tally"><span>${ICON.yes} ${t.yes} yes</span><span>${ICON.part} ${t.part} partly</span><span>${ICON.no} ${t.no} no</span><span>${ICON.unk} ${t.unk} unknown</span></div></div>` : ''}
    <div class="actions">
      <button class="btn btn-purple btn-sm" id="b-cmp">${inCmp ? '✓ In comparison' : '+ Add to compare'}</button>
      <button class="btn btn-ghost btn-sm" id="b-brief">Copy briefing paragraph</button>
      <button class="btn btn-ghost btn-sm" id="b-link">Copy link</button>
      <a class="btn btn-ghost btn-sm" href="${official(e)}" target="_blank" rel="noopener">View on zerotracker.net ↗</a>
    </div>
  </div></section>

  <section class="tight band"><div class="wrap">
    <h2 class="h-brand" style="font-size:24px">Timeline</h2>
    <div class="timeline">${timelineSVG(e)}</div>
    <h3 class="mt2" style="font-size:19px">How firm is the commitment?</h3>
    <div class="ladder">${LADDER.map(l => `<div class="${Math.floor(L.k)===l.k ? 'on' : L.k>l.k ? 'past' : ''}"><b>${l.label}</b>${l.plain}</div>`).join('')}<div class="${L.k<=0 ? 'on' : ''}" style="background:#f3f1f5"><b>${L.k<0 ? 'Other target' : 'No net zero target'}</b>${L.k<0 ? 'Not net zero' : 'Nothing found'}</div></div>
    <div style="height:26px"></div>
  </div></section>

  <section class="tight"><div class="wrap">
    <div class="flex" style="justify-content:space-between"><h2 class="h-brand" style="font-size:24px">Credibility checklist</h2><a href="#/learn/method" style="font-size:15px">Why these questions?</a></div>
    ${!isNZ(e) ? `<div class="note mt1">There is no net zero target, so these checks describe ${hasAnyTarget(e) ? 'its other climate target' : 'what any future target should include'}.</div>` : ''}
    <div class="checks mt2">${PILLARS.map(p => `<div class="card" style="--p:${p.col}"><h3><i></i>${p.name}</h3>${cs.filter(c => c.p === p.id).map(c => `<div class="item">${vtag(c.v)}<div><div class="q">${c.q}</div><div class="a">${esc(c.a)}</div><details><summary>Why it matters</summary>${esc(c.why)}</details></div></div>`).join('')}</div>`).join('')}</div>
  </div></section>

  <section class="tight band"><div class="wrap">
    <h2 class="h-brand" style="font-size:24px">How it compares</h2>
    ${pr.small ? `<p class="muted mt0">${esc(e.n)} has about ${fmt(e.pop)} people. The Tracker's city coverage starts at 500,000, so there is no peer group for it. Choose a city to compare it with.</p>
    <div class="light mt1" style="max-width:520px">${searchBox('s-peer', 'Search for a city to compare with…')}</div><p id="peer-msg" class="muted" style="font-size:14px" hidden>Please pick a city from the list.</p>` : `    <div class="seg peerseg" id="peerseg" role="group" aria-label="Compare with">${peerModes(e).map(([m, l]) => `<button data-m="${m}" class="${m === pr.mode ? 'on' : ''}"${m === 'country' && byType(e.t).filter(x => x.c === e.c && (e.t !== 'city' || x.pop >= CITY_MIN)).length < 3 ? ' disabled title="Too few entries in this country"' : ''}><b>${l}</b></button>`).join('')}</div>
    <p class="muted mt1">Compared with ${pr.mode === 'size' ? '' : pr.mode === 'world' && e.t === 'company' ? 'all ' : 'the '}${fmt(px.length)} ${esc(pr.label)}. ${esc(peerBasis(e))}${peerBasis(e) ? ' ' : ''}Bars show the share of peers that meet each check. The right-hand column shows ${esc(e.n)}.</p>
    <table class="gap-chart peer" style="max-width:900px">${peerRows.map(([lab, fn, me]) => { const v = pct(px.filter(fn).length, px.length); return `<tr><td class="q" style="width:45%">${esc(lab)}</td><td><div class="hb"><div class="tr"><i style="width:${v}%"></i></div><span>${v}%</span></div></td><td style="width:110px;font-weight:700;color:${me ? 'var(--ok)' : 'var(--bad)'};white-space:nowrap">${me ? '✓ ' : '✗ '}${esc(e.n.length > 14 ? (e.t==='company'?'This company':'This entry') : e.n)}</td></tr>`; }).join('')}</table>`}
  </div></section>

  <section class="tight"><div class="wrap grid2">
    <div><h2 class="h-brand" style="font-size:24px">Questions to ask</h2><p class="muted mt0">Generated from the gaps above. Use them in consultations, AGMs, council meetings or interviews.</p>
      <ol class="asks">${asks(e).map(([q, s]) => `<li>${esc(q)}<small>${esc(s)}</small></li>`).join('')}</ol></div>
    <div><h2 class="h-brand" style="font-size:24px">Briefing paragraph</h2><p class="muted mt0">Neutral wording for a memo or briefing note.</p>
      <div class="brief" id="brief">${esc(briefing(e))}</div>
      <div class="actions"><button class="btn btn-ghost btn-sm" id="b-brief2">Copy</button></div></div>
  </div></section>

  <section class="tight band"><div class="wrap">
    <h2 class="h-brand" style="font-size:24px">Sources and other views</h2>
    <div class="srcs mt1">
      <div class="card"><h4>Primary source</h4><p>The document our researchers used for this entry.</p>${e.src ? `<a href="${esc(e.src)}" target="_blank" rel="noopener">Open source document ↗</a>` : '<span class="muted">Not listed</span>'}</div>
      ${e.cat ? `<div class="card"><h4>Climate Action Tracker</h4><p>Independent rating of this net zero target: <b>${esc(e.cat)}</b>.</p>${e.catu ? `<a href="${esc(e.catu)}" target="_blank" rel="noopener">See assessment ↗</a>` : ''}</div>` : ''}
      ${e.clw ? `<div class="card"><h4>Climate Change Laws of the World</h4><p>The country's climate laws and policies.</p><a href="${esc(e.clw)}" target="_blank" rel="noopener">Country profile ↗</a></div>` : ''}
      ${e.eciu ? `<div class="card"><h4>ECIU Net Zero Scorecard</h4><p>Status: <b>${esc(e.eciu)}</b>.</p></div>` : ''}
      <div class="card"><h4>Is this out of date?</h4><p>Entry last updated ${esc(e.upd || 'n/a')}. Our researchers review submissions.</p><a href="https://form.typeform.com/to/ZyfGb9tZ" target="_blank" rel="noopener">Request an update ↗</a></div>
    </div>
    <div class="cite mt2"><b>Cite this entry:</b> Net Zero Tracker (${(e.upd||'').slice(0,4) || NOW}). <i>${esc(e.n)}</i>. Energy &amp; Climate Intelligence Unit, Data-Driven EnviroLab, NewClimate Institute and Oxford Net Zero. ${official(e)}</div>
  </div></section>`;
};
P.entity.after = (params, slug) => {
  const e = BY[slug]; if (!e) return;
  $('#b-cmp').onclick = () => { let a = compareSet.get(); if (a.includes(e.s)) { location.hash = '#/compare'; return; } a = [...a, e.s].slice(-4); compareSet.set(a); $('#b-cmp').textContent = '✓ In comparison: view'; toast(`Added. ${a.length} in comparison.`); };
  $('#b-brief').onclick = $('#b-brief2').onclick = () => copy(briefing(e));
  $('#b-link').onclick = () => copy(location.href);
  $$('#peerseg button').forEach(b => b.onclick = () => { PM[e.t] = b.dataset.m; const y = scrollY; route(); scrollTo(0, y); });
  if ($('#s-peer')) wireSearch('s-peer', o => { if (o.s === e.s) return; compareSet.set([e.s, o.s]); location.hash = '#/compare'; }, x => x.t === 'city' && x.s !== slug);
};

/* ---------- COMPARE ---------- */
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
    <div class="mt1">${es.map(e => `<span class="chip">${typeBadge(e.t)} ${esc(e.n)} <button aria-label="Remove ${esc(e.n)}" data-rm="${e.s}">×</button></span>`).join('')}</div>
    <div class="light mt1" style="max-width:520px">${searchBox('s-cmp', es.length >= 4 ? 'Remove one to add another (max 4)' : 'Add an entry…')}</div>
    ${compareSet.get().length ? '' : '<p class="muted" style="font-size:14px">Showing an example. Add your own to replace it.</p>'}
  </div></section>
  <section class="tight"><div class="wrap"><div class="tablewrap" style="border:0"><table class="cmp">
    <thead><tr><th></th>${es.map(e => `<th><a href="#/e/${e.s}" style="color:inherit">${e.t==='country'?flag(e.a2)+' ':''}${esc(e.n)}</a><div style="font-weight:400;font-size:13px">${TYPE[e.t][0]}${e.cn && e.t!=='country' ? ' · ' + esc(e.cn) : ''}</div></th>`).join('')}</tr></thead>
    <tbody>
      <tr class="grp"><td colspan="${es.length+1}">Headline</td></tr>
      ${row('Target', e => `<b>${esc(targetPhrase(e))}</b>`)}
      ${row('How firm?', e => pill(e))}
      ${row('Next milestone', e => e.it && e.it !== 'No target' ? esc((e.ip ? e.ip + '% cut' : e.it) + (iyear(e) ? ' by ' + iyear(e) : '') + (e.ib ? ' vs ' + e.ib : '')) : '<span class="muted">None</span>')}
      ${row('Credibility checks met', (e,i) => isNZ(e) ? `<b style="font-size:20px">${tally(C[i]).yes}</b> of ${C[i].length}` : '<span class="muted">No net zero target</span>')}
      ${PILLARS.map(p => `<tr class="grp"><td colspan="${es.length+1}">${p.name}</td></tr>` + [...new Set(C.flat().filter(c => c.p === p.id).map(c => c.id))].map(id => { const q = C.flat().find(c => c.id === id).q; return row(q, (e,i) => { const c = C[i].find(k => k.id === id); return c ? `<div class="cell">${vtag(c.v)}<span>${esc(c.a)}</span></div>` : '<span class="muted">Not applicable</span>'; }); }).join('')).join('')}
    </tbody></table></div>
    <div class="actions"><button class="btn btn-ghost btn-sm" id="cmp-link">Copy link to this comparison</button></div>
  </div></section>`;
};
P.compare.after = () => {
  wireSearch('s-cmp', e => { const a = compareSet.get(); if (a.length >= 4 || a.includes(e.s)) return toast(a.includes(e.s) ? 'Already added' : 'Maximum of 4'); compareSet.set([...a, e.s]); route(); });
  $$('[data-rm]').forEach(b => b.onclick = () => { const cur = compareSet.get().length ? compareSet.get() : $$('[data-rm]').map(x => x.dataset.rm); compareSet.set(cur.filter(s => s !== b.dataset.rm)); history.replaceState(null, '', '#/compare'); route(); });
  $('#cmp-link').onclick = () => { const ids = compareSet.get().length ? compareSet.get() : $$('[data-rm]').map(x => x.dataset.rm); copy(location.href.split('#')[0] + '#/compare?ids=' + ids.join(',')); };
};

/* ---------- LEARN ---------- */
const GLOSS = [
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
P.learn = (params, sub) => `
  <section class="hero" style="padding:48px 0"><div class="wrap"><p class="eyebrow" style="color:#ffb3a8">Net zero explained</p><h1 style="font-size:clamp(30px,4.5vw,46px)">What net zero means, and how to tell a real target from a slogan</h1><p>A 2-minute primer, a glossary, and how we assess every target.</p></div></section>
  <section><div class="wrap grid2" style="align-items:center">
    <div><h2 class="h-brand">Net zero in one picture</h2>
    <p class="lede">Emissions are the heat-trapping gases, mostly carbon dioxide, released when we burn coal, oil and gas. <b>Net zero</b> means cutting them as far as we can, then taking the small amount left back out of the air.</p><p>It does <b>not</b> mean releasing nothing. It means roughly 90% or more is cut first.</p>
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
  <section class="band"><div class="wrap">
    <h2 class="h-brand">Glossary</h2><p class="lede mt0">Every technical term on this site, in one line, plus why it matters.</p>
    <div class="gloss mt2">${GLOSS.map(([t,d,w]) => `<details><summary>${t}</summary><p class="plain">${d}</p><p>${w}</p></details>`).join('')}</div>
  </div></section>`;
P.learn.after = (params, sub) => { nzdWire(); if (sub === 'method' || sub === 'offsets') setTimeout(() => $('#' + sub)?.scrollIntoView(), 30); };
const NZD = {
  today:['Today’s emissions','Gases released when we burn coal, oil and gas for electricity, transport, heating and industry. Shown as 100 units so the other bars read as percentages.'],
  cut:['Cutting emissions','Releasing less in the first place: clean electricity from sun and wind, electric vehicles, better insulated buildings, less waste. Net zero standards ask for roughly 90% or more.'],
  left:['What is left over','Emissions that are very hard to avoid, such as from making cement and steel or from farming. This should be small.'],
  rem:['Removing the remainder','Pulling carbon dioxide back out of the air and storing it for good, for example capturing it and locking it underground. It only balances this small leftover.'],
  net:['Net zero','What goes into the air is balanced by what is taken out, so no extra CO₂ is added to the atmosphere.']
};
function netZeroDiagram(){
  return `<div class="nzd" id="nzd">
  <p class="nzd-def"><b>What are emissions?</b> Gases, mostly carbon dioxide (CO₂), that go into the air when we burn coal, oil and gas for electricity, cars, heating and factories. They trap heat and warm the planet.</p>
  <div class="nzs"><h4><i>1</i>Today</h4><svg viewBox="0 0 520 46" id="nz1" role="img" aria-label="One bar showing all of today’s emissions"></svg><p id="nzt1"></p></div>
  <div class="nzs"><h4><i>2</i>Cut emissions at the source</h4><svg viewBox="0 0 520 46" id="nz2" role="img" aria-label="The bar shrinks after cuts, leaving a small remainder"></svg><p id="nzt2"></p></div>
  <div class="nzs"><h4><i>3</i>Take out what is left</h4><svg viewBox="0 0 520 46" id="nz3" role="img" aria-label="Removal of the remainder balances it to net zero"></svg><p id="nzt3"></p></div>
  <div class="nzd-cap" id="nzd-cap" aria-live="polite"></div>
  <label class="nzd-ctl" for="nzd-cut"><span>Try it: how much do emissions get cut?</span><input type="range" id="nzd-cut" min="40" max="98" value="90"><output id="nzd-out">90%</output></label></div>`;
}
function nzdDraw(cut, act){
  const L = 100 - cut, X = 4, K = 5.12, ok = L <= 15, wL = Math.max(L * K, 3), wC = cut * K, y = 3, h = 40;
  const G = (key, inner) => `<g class="nzp ${act && act !== key ? 'dim' : ''} ${act === key ? 'hot' : ''}" data-p="${key}" tabindex="0" role="button" aria-label="${esc(NZD[key][0])}">${inner}</g>`;
  const tx = (x, t, col, sz = 16) => `<text x="${x}" y="${y + 26}" text-anchor="middle" font-size="${sz}" font-weight="800" fill="${col}">${t}</text>`;
  $('#nz1').innerHTML = G('today', `<rect x="${X}" y="${y}" width="512" height="${h}" rx="5" fill="#A5865C"/>${tx(260, '100 units of emissions', '#fff', 17)}`);
  $('#nz2').innerHTML = G('left', `<rect x="${X}" y="${y}" width="${wL}" height="${h}" rx="4" fill="#A5865C"/>${wL > 34 ? tx(X + wL / 2, L, '#fff') : ''}`)
    + G('cut', `<rect x="${X + wL}" y="${y}" width="${wC}" height="${h}" rx="4" fill="#e6f3df" stroke="#5EA845" stroke-width="1.5" stroke-dasharray="5 4"/>${tx(X + wL + wC / 2, cut + '% cut', '#3d7a2b', 17)}`);
  $('#nz3').innerHTML = `<rect x="${X + wL}" y="${y}" width="${wC}" height="${h}" rx="4" fill="none" stroke="#d9d3df" stroke-dasharray="3 4"/>`
    + G('rem', `<rect x="${X}" y="${y}" width="${wL}" height="${h}" rx="4" fill="${ok ? '#3B7CC3' : '#E13B26'}"/>${wL > 34 ? tx(X + wL / 2, '−' + L, '#fff') : ''}`)
    + G('net', ok ? `<rect x="404" y="${y}" width="112" height="${h}" rx="20" fill="#3B7CC3"/>${tx(460, '= net zero', '#fff')}` : `<rect x="384" y="${y}" width="132" height="${h}" rx="20" fill="#fff" stroke="#E13B26" stroke-width="2"/>${tx(450, 'not net zero', '#c8331f')}`);
  $('#nzt1').textContent = 'The whole bar is every bit of CO₂ and other heat-trapping gases released in a year. We call it 100 units.';
  $('#nzt2').textContent = `Stop releasing them: power homes with sun and wind instead of coal, switch to electric cars, insulate buildings, waste less. After a ${cut}% cut, ${L} of the 100 units are left.`;
  $('#nzt3').textContent = ok ? `A small amount is very hard to avoid, such as emissions from making cement or from farming. Capturing that carbon and storing it underground cancels it out. Result: net zero.` : `Removing ${L} units would take far more carbon removal than exists today.`;
  const cap = act ? `<b>${esc(NZD[act][0])}.</b> ${esc(NZD[act][1])}` : (ok ? '<b>Cut deeply first, then take out only what is left.</b> Hover or tap any part of the picture to see what it means.' : `<b class="bad">Too little cut.</b> With ${L}% left over, you would need to remove carbon equal to ${L}% of today’s emissions. Removal on that scale is not available with today’s technology, so targets like this tend to lean on offsets instead. <a href="#/learn/offsets">Why offsets can be greenwashing →</a>`);
  $('#nzd-cap').innerHTML = cap; $('#nzd-cap').classList.toggle('warn', !ok && !act);
}
function nzdWire(){
  let cut = 90, act = null; const svg = $('#nzd'); if (!svg) return;
  const draw = () => nzdDraw(cut, act);
  const set = k => { if (k !== act) { act = k; draw(); } };
  svg.addEventListener('mouseover', ev => set(ev.target.closest('[data-p]')?.dataset.p || null));
  svg.addEventListener('mouseleave', () => set(null));
  svg.addEventListener('focusin', ev => set(ev.target.closest('[data-p]')?.dataset.p || null));
  svg.addEventListener('focusout', () => set(null));
  svg.addEventListener('click', ev => set(ev.target.closest('[data-p]')?.dataset.p || null));
  $('#nzd-cut').oninput = e => { cut = +e.target.value; $('#nzd-out').textContent = cut + '%'; draw(); };
  draw();
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
P.activists = () => {
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
    <div class="card" style="align-self:start;border-top:5px solid var(--red)"><h3>Six warning signs of a weak pledge</h3>
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
  </div></section>
  <section class="band"><div class="wrap">
    <h2 class="h-brand">Among the world's 200 largest public companies, no net zero target yet</h2>
    <p class="lede mt0">Ranked by annual revenue. Each profile lists the questions to put to them.</p>
    <div class="grid4 mt2">${noT.map(e => `<a class="card path" href="#/e/${e.s}" style="border-top-color:var(--red)"><span class="who">${esc(e.cn || '')}</span><h3 style="margin:.2em 0">${esc(e.n)}</h3><p class="muted" style="margin:0">${esc(e.sec || '')} · ${money(e.rev)} revenue</p><p style="margin:.5em 0 0">${esc(targetPhrase(e))}</p><span class="go mt1">See profile →</span></a>`).join('')}</div>
    <p class="mt2"><a href="#/explore?type=company&st=0">See all companies without a target →</a></p>
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
P.activists.after = () => wireSearch('s-act');

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
      <div><h3>Clearer graphics elsewhere</h3><p>Donut charts become labelled bars, and a new "credibility gap" chart shows which elements targets lack.</p></div>
    </div></div>
    <div><h2 class="h-brand" style="font-size:24px">Things we noticed on the live site</h2>
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
        <li>The newsletter box links to the live Mailchimp sign-up page. It can be closed and stays closed for the rest of the visit.</li>
        <li>The map uses the live site's own boundary and city-location files. 16 regions and 1 city have no location in them yet, so they appear in the tables but not on the map.</li>
      </ul>
      <div class="note mt2">Prototype by Shiva Rajbhandari, ${META.generated || ''}. Data: Net Zero Tracker public dataset (entries updated to ${esc((META.source||'').split('to ').pop())}). Not indexed by search engines.</div>
    </div>
  </div></section>`;

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

/* ---------- router ---------- */
function route(){
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?'); const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  let page = parts[0] || 'home', arg = parts[1];
  if (page === 'e') page = 'entity';
  if (!P[page]) page = 'home';
  hideTip();
  $('#main').innerHTML = P[page](params, arg);
  $$('#nav a[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === page));
  $('#nav').classList.remove('open');
  document.title = (page === 'entity' && BY[arg] ? BY[arg].n + ' | ' : page !== 'home' ? ({explore:'Explore',compare:'Compare',learn:'Learn',goodnet:'Good net zero',policymakers:'For policymakers',activists:'For advocates',notes:'About this prototype',faqs:'FAQs',about:'About & contact'}[page] + ' | ') : '') + 'Net Zero Tracker (prototype)';
  if (P[page].after) P[page].after(params, arg);
  if (!(page === 'learn' && arg)) window.scrollTo(0, 0);
}
const asof = (META.source || '').match(/(\d{4})-(\d{2})/); if (asof) $('#asof').textContent = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+asof[2]-1] + ' ' + asof[1];
addEventListener('hashchange', route);
route();
})();
