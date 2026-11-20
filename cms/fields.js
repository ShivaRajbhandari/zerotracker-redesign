/* Field definitions for Net Zero Tracker records, shared by the editor's data form, the CSV importer
   and the publish build. Works in the browser (window.NZTFields) and in Node (module.exports). */
(function (root) {
  'use strict';
  var YN = ['Yes', 'No'], YNU = ['Yes', 'No', 'Not Specified'];
  var G = [
    // group, key, label, kind, options/help
    ['Basics', 'n', 'Name', 'text', {required: true}],
    ['Basics', 't', 'Type', 'select', {required: true, options: ['country', 'region', 'city', 'company'], labels: ['Country', 'Region', 'City', 'Company']}],
    ['Basics', 's', 'Web address ID', 'text', {help: 'Used in the profile link (#/e/…). Leave empty for a new entry and it is made from the name.'}],
    ['Basics', 'cn', 'Country', 'text', {required: true, help: 'Country name, for example Brazil. For a country, the same as its name.'}],
    ['Basics', 'c', 'Country code (3 letters)', 'text', {help: 'ISO code, for example BRA.'}],
    ['Basics', 'a2', 'Country code (2 letters)', 'text', {help: 'For example BR. Used for the flag.'}],
    ['Basics', 'g', 'World region', 'select', {options: ['Africa', 'East Asia', 'Europe', 'Latin America and Caribbean', 'North America', 'Oceania', 'South Asia', 'Western and Central Asia']}],
    ['Basics', 'sec', 'Sector (companies)', 'select', {options: null}],
    ['Basics', 'priv', 'Privately owned (companies)', 'select', {options: YN}],
    ['Net zero target', 'e', 'Target type', 'select', {options: null}],
    ['Net zero target', 'y', 'Target year', 'year'],
    ['Net zero target', 'st', 'Status', 'select', {options: ['Proposed / in discussion', 'Declaration / pledge', 'In policy document', 'In corporate strategy', 'In law', 'Achieved (self-declared)']}],
    ['Net zero target', 'sd', 'Year the target was set', 'year'],
    ['Net zero target', 'ep', 'Percent cut (for a reduction target)', 'number'],
    ['Net zero target', 'eb', 'Base year of that cut', 'year'],
    ['Interim target', 'it', 'Interim target type', 'select', {options: ['No target', 'Emissions reduction target', 'Emissions intensity target', 'Net zero or similar', 'Reduction v. BAU', 'Other']}],
    ['Interim target', 'iy', 'Interim target year', 'year'],
    ['Interim target', 'ip', 'Interim percent cut', 'number'],
    ['Interim target', 'ib', 'Interim base year', 'year'],
    ['Interim target', 'ms', 'Milestones', 'milestones', {help: 'One per line, as year: description. For example 2030: 50% cut'}],
    ['How the target is designed', 'gas', 'Gases covered', 'select', {options: ['Carbon dioxide and other GHGs', 'Carbon dioxide only', 'Not Specified']}],
    ['How the target is designed', 's3', 'Covers Scope 3 (companies)', 'select', {options: ['Yes', 'Partial', 'No', 'Not Specified']}],
    ['How the target is designed', 'cons', 'Counts consumption emissions (governments)', 'select', {options: YNU}],
    ['How the target is designed', 'plan', 'Published plan', 'select', {options: YN}],
    ['How the target is designed', 'po', 'Plan elements (0 to 4)', 'number'],
    ['How the target is designed', 'rep', 'Progress reporting', 'select', {options: ['Annual reporting', 'Less than annual reporting', 'No reporting mechanism']}],
    ['How the target is designed', 'acc', 'Formal accountability', 'select', {options: YNU}],
    ['How the target is designed', 'off', 'Plans to use offsets', 'select', {options: YNU}],
    ['How the target is designed', 'cond', 'Conditions on offsets', 'text', {help: 'Separate several with |'}],
    ['How the target is designed', 'rem', 'Separate goals for cuts and removals', 'select', {options: YN}],
    ['How the target is designed', 'cdr', 'Carbon removal (cdr)', 'text'],
    ['How the target is designed', 'hist', 'Historical responsibility (hist)', 'select', {options: YN}],
    ['How the target is designed', 'eq', 'Fairness considered (eq)', 'select', {options: YN}],
    ['How the target is designed', 'av', 'Aviation and shipping (av)', 'select', {options: YNU}],
    ['How the target is designed', 'r2z', 'Member of Race to Zero', 'select', {options: YN}],
    ['Size and emissions', 'pop', 'Population', 'number', {help: 'Needed for cities.'}],
    ['Size and emissions', 'gdp', 'GDP (US$)', 'number'],
    ['Size and emissions', 'rev', 'Annual revenue (US$, companies)', 'number'],
    ['Size and emissions', 'ghg', 'Emissions (tCO₂e)', 'number'],
    ['Size and emissions', 'iy_inv', 'Year of those emissions', 'year'],
    ['Size and emissions', 'll', 'Map position (cities)', 'latlon', {help: 'Latitude, longitude. For example -23.55, -46.63'}],
    ['Sources and links', 'src', 'Source document (URL)', 'url'],
    ['Sources and links', 'upd', 'Last updated', 'date'],
    ['Sources and links', 'iso', 'ISO numeric code (countries)', 'text'],
    ['Sources and links', 'cat', 'Climate Action Tracker rating', 'text'],
    ['Sources and links', 'catu', 'Climate Action Tracker link', 'url'],
    ['Sources and links', 'clw', 'Climate Change Laws of the World link', 'url'],
    ['Sources and links', 'eciu', 'ECIU Net Zero Scorecard status', 'text']
  ];
  var FIELDS = G.map(function (r) { var o = r[4] || {}; return {group: r[0], key: r[1], label: r[2], kind: r[3], required: !!o.required, options: o.options, labels: o.labels, help: o.help || ''}; });
  var BY_KEY = {}; FIELDS.forEach(function (f) { BY_KEY[f.key] = f; });

  // option lists that come from the data itself
  function fillOptions(D) {
    var uniq = function (k) { var s = {}; D.forEach(function (e) { if (e[k]) s[e[k]] = 1; }); return Object.keys(s).sort(); };
    BY_KEY.sec.options = uniq('sec'); BY_KEY.e.options = uniq('e');
    FIELDS.forEach(function (f) { if (f.kind === 'select' && f.options) { var have = uniq(f.key); have.forEach(function (v) { if (f.options.indexOf(v) < 0) f.options.push(v); }); } });
  }

  var slugify = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); };
  var TYPE_SHORT = {country: 'cou', region: 'reg', city: 'cit', company: 'com'};
  function newSlug(rec) { return slugify(rec.n) + '-' + (TYPE_SHORT[rec.t] || 'x') + '-new'; }

  // value <-> text for the form and CSV
  function toText(f, v) {
    if (v == null) return '';
    if (f.kind === 'milestones') return (v || []).map(function (m) { return m[0] + ': ' + m[1]; }).join('\n');
    if (f.kind === 'latlon') return Array.isArray(v) ? v.join(', ') : String(v);
    return String(v);
  }
  function fromText(f, s) {
    s = s == null ? '' : String(s).trim();
    if (s === '') return '';
    if (f.kind === 'number') { var n = +s.replace(/[, ]/g, ''); return isFinite(n) ? n : s; }
    if (f.kind === 'milestones') return s.split(/\n|;/).map(function (l) { var m = l.match(/^\s*(\d{4})\s*[:\-–]\s*(.+)$/); return m ? [+m[1], m[2].trim()] : null; }).filter(Boolean);
    if (f.kind === 'latlon') { var p = s.split(/[,\s]+/).map(Number); return p.length === 2 && p.every(isFinite) ? p : ''; }
    if (f.kind === 'select' && f.options) { var hit = f.options.filter(function (o) { return o.toLowerCase() === s.toLowerCase(); })[0]; if (hit) return hit; if (f.labels) { var i = f.labels.map(function (x) { return x.toLowerCase(); }).indexOf(s.toLowerCase()); if (i >= 0) return f.options[i]; } }
    return s;
  }
  // which field a CSV column means: its key (n, cn …) or its label, any case
  function columnField(col) {
    var c = String(col).trim().toLowerCase().replace(/\s+/g, ' ');
    if (c === 'slug' || c === 'id') return BY_KEY.s;
    if (c === 'name') return BY_KEY.n;
    if (c === 'type') return BY_KEY.t;
    return FIELDS.filter(function (f) { return f.key.toLowerCase() === c || f.label.toLowerCase() === c; })[0] || null;
  }
  // turn uploaded rows into patches. index = {bySlug, byNameType} from the current data.
  function rowsToPatches(rows, columns, includeAll, index) {
    var map = columns.map(columnField), out = [], problems = [], stats = {updated: 0, added: 0, skipped: 0, extra: 0};
    rows.forEach(function (row, i) {
      var p = {}, x = {};
      columns.forEach(function (col, j) {
        var f = map[j], v = row[col];
        if (f) { var val = fromText(f, v); if (val !== '') p[f.key] = val; }
        else if (includeAll && v != null && String(v).trim() !== '') x[String(col).trim()] = String(v).trim();
      });
      if (Object.keys(x).length) { p.x = x; stats.extra++; }
      var hit = p.s && index.bySlug[p.s] ? p.s : (p.n && p.t ? index.byNameType[(p.n + '|' + p.t).toLowerCase()] : null);
      if (hit) { p.s = hit; stats.updated++; }
      else {
        if (!p.n || !p.t || !p.cn) { problems.push('Row ' + (i + 2) + ': a new entry needs at least Name, Type and Country.'); stats.skipped++; return; }
        if (p.t === 'city' && !(+p.pop > 0)) { problems.push('Row ' + (i + 2) + ': a new city also needs its Population.'); stats.skipped++; return; }
        if (!p.s) p.s = newSlug(p);
        stats.added++;
      }
      out.push(p);
    });
    return {patches: out, problems: problems, stats: stats, unknown: columns.filter(function (c, j) { return !map[j]; })};
  }
  function makeIndex(D) {
    var bySlug = {}, byNameType = {};
    D.forEach(function (e) { bySlug[e.s] = e; byNameType[(e.n + '|' + e.t).toLowerCase()] = e.s; });
    return {bySlug: bySlug, byNameType: byNameType};
  }
  function templateCsv(D) {
    var cols = FIELDS.map(function (f) { return f.key; });
    var q = function (s) { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var sample = D.filter(function (e) { return e.t === 'country'; }).slice(0, 2).concat(D.filter(function (e) { return e.t === 'company'; }).slice(0, 1));
    return [cols.join(',')].concat(sample.map(function (e) { return cols.map(function (k) { return q(toText(BY_KEY[k], e[k])); }).join(','); })).join('\n') + '\n';
  }

  var api = {FIELDS: FIELDS, BY_KEY: BY_KEY, fillOptions: fillOptions, slugify: slugify, newSlug: newSlug, toText: toText, fromText: fromText,
    columnField: columnField, rowsToPatches: rowsToPatches, makeIndex: makeIndex, templateCsv: templateCsv};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NZTFields = api;
})(typeof window !== 'undefined' ? window : this);
