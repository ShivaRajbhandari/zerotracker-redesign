/* Net Zero Tracker editor: custom widgets (entry form, CSV upload) and the live preview.
   The preview is the real site in a frame (?cmspreview=1); unsaved changes are sent to it by postMessage. */
(function () {
  'use strict';
  var CMS = window.CMS, h = window.h, createClass = window.createClass, F = window.NZTFields;
  var D = window.NZT || [];
  F.fillOptions(D);
  var SITE = new URL('../', location.href).href;            // .../zerotracker-redesign/
  var js = function (v) { return v && v.toJS ? v.toJS() : v; };
  var BY = {}; D.forEach(function (e) { BY[e.s] = e; });

  var css = document.createElement('style');
  css.textContent = [
    '.nzw{font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1622}',
    '.nzw .grp{margin:18px 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5b3f7a}',
    '.nzw .fld{display:grid;grid-template-columns:minmax(150px,34%) 1fr;gap:4px 12px;align-items:start;padding:7px 0;border-top:1px solid #eee}',
    '.nzw .fld label{font-weight:600;font-size:14px;padding-top:7px}.nzw .fld .req{color:#c8331f}',
    '.nzw input,.nzw select,.nzw textarea{font:inherit;width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #cfcad6;border-radius:6px;background:#fff}',
    '.nzw textarea{min-height:64px}.nzw .help{grid-column:2;font-size:12.5px;color:#6b6475}',
    '.nzw .pick{position:relative;margin-bottom:6px}.nzw .res{position:absolute;z-index:5;left:0;right:0;top:100%;background:#fff;border:1px solid #cfcad6;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,.12);max-height:280px;overflow:auto}',
    '.nzw .res button{display:block;width:100%;text-align:left;border:0;background:none;padding:8px 10px;cursor:pointer;font:inherit}.nzw .res button:hover{background:#f3eef8}',
    '.nzw .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.nzw .btn{font:inherit;font-weight:600;border:1px solid #271039;background:#fff;color:#271039;border-radius:6px;padding:6px 12px;cursor:pointer}',
    '.nzw .btn.pri{background:#271039;color:#fff}.nzw .card{border:1px solid #e3dfe8;border-radius:8px;padding:12px 14px;margin:10px 0;background:#faf9fb}',
    '.nzw .muted{color:#6b6475}.nzw .bad{color:#c8331f}.nzw .ok{color:#2f8a4c}.nzw .chips span{display:inline-block;border:1px solid #ddd;border-radius:99px;padding:1px 8px;margin:2px;font-size:12.5px;background:#fff}',
    '.nzw table{border-collapse:collapse;font-size:13px;width:100%}.nzw td,.nzw th{border-top:1px solid #eee;padding:4px 6px;text-align:left}'
  ].join('');
  document.head.appendChild(css);

  /* ================= Entry form ================= */
  var RecordControl = createClass({
    getInitialState: function () { return {q: '', open: false}; },
    val: function () { return js(this.props.value) || {}; },
    set: function (rec) { this.props.onChange(rec); },
    isValid: function () {
      var r = this.val();
      if (!r.n || !r.t || !r.cn) return {error: {message: 'An entry needs at least a Name, a Type and a Country.'}};
      if (r.t === 'city' && !(+r.pop > 0)) return {error: {message: 'A city also needs its Population.'}};
      return true;
    },
    load: function (e) { var c = JSON.parse(JSON.stringify(e)); this.setState({q: '', open: false}); this.set(c); },
    fresh: function () { this.set({t: 'country'}); },
    change: function (f, txt) {
      var r = Object.assign({}, this.val()), v = F.fromText(f, txt);
      if (v === '') delete r[f.key]; else r[f.key] = v;
      if ((f.key === 'n' || f.key === 't') && (!r.s || /-new$/.test(r.s)) && !BY[r.s] && r.n) r.s = F.newSlug(r);
      this.set(r);
    },
    render: function () {
      var self = this, r = this.val(), q = this.state.q.toLowerCase();
      var hits = q.length > 1 ? D.filter(function (e) { return e.n.toLowerCase().indexOf(q) >= 0; }).slice(0, 12) : [];
      var exists = r.s && BY[r.s];
      var head = h('div', {className: 'card'},
        h('div', {className: 'row', style: {justifyContent: 'space-between'}},
          h('b', null, exists ? 'Editing: ' + BY[r.s].n + ' (' + BY[r.s].t + ')' : r.n ? 'New entry: ' + r.n : 'Start by choosing an entry to edit, or start a new one'),
          h('button', {type: 'button', className: 'btn', onClick: this.fresh}, 'Start a new entry')),
        h('div', {className: 'pick', style: {marginTop: '10px'}},
          h('input', {type: 'search', placeholder: 'Find an existing country, region, city or company…', value: this.state.q,
            onChange: function (ev) { self.setState({q: ev.target.value, open: true}); }}),
          this.state.open && hits.length ? h('div', {className: 'res'}, hits.map(function (e) {
            return h('button', {type: 'button', key: e.s, onClick: function () { self.load(e); }}, e.n + ' · ' + e.t + (e.cn && e.t !== 'country' ? ' · ' + e.cn : ''));
          })) : null),
        exists ? h('div', {className: 'muted', style: {fontSize: '13px'}}, 'Change any field below. Fields you clear are removed from the entry. ',
          h('a', {href: SITE + '#/e/' + r.s, target: '_blank', rel: 'noopener'}, 'Open the live profile ↗')) : null);
      var group = null, rows = [];
      F.FIELDS.forEach(function (f) {
        if (f.group !== group) { group = f.group; rows.push(h('div', {className: 'grp', key: 'g' + group}, group)); }
        var txt = F.toText(f, r[f.key]), id = 'nzf-' + f.key, input;
        var on = function (ev) { self.change(f, ev.target.value); };
        if (f.kind === 'select') {
          var opts = (f.options || []).slice(); if (txt && opts.indexOf(txt) < 0) opts.unshift(txt);
          input = h('select', {id: id, value: txt, onChange: on}, [h('option', {value: '', key: '_'}, '—')].concat(opts.map(function (o, i) {
            return h('option', {value: o, key: o}, f.labels && f.options.indexOf(o) >= 0 ? f.labels[f.options.indexOf(o)] : o);
          })));
        } else if (f.kind === 'milestones') input = h('textarea', {id: id, value: txt, onChange: on});
        else input = h('input', {id: id, value: txt, onChange: on, type: f.kind === 'url' ? 'url' : f.kind === 'date' ? 'date' : 'text', inputMode: f.kind === 'number' || f.kind === 'year' ? 'decimal' : undefined});
        rows.push(h('div', {className: 'fld', key: f.key}, h('label', {htmlFor: id}, f.label, f.required ? h('span', {className: 'req'}, ' *') : null), input,
          f.help ? h('div', {className: 'help'}, f.help) : null));
      });
      var extra = r.x && Object.keys(r.x).length ? h('div', {className: 'card'}, h('b', null, 'Extra fields from data uploads: '), Object.keys(r.x).length + ' (shown under All data fields on the profile)') : null;
      return h('div', {className: 'nzw'}, head, rows, extra);
    }
  });
  CMS.registerWidget('nzt-record', RecordControl, function () { return h('div', null); });

  /* ================= CSV upload ================= */
  function summarize(up, includeAll) {
    if (!up || !up.rows) return null;
    return F.rowsToPatches(up.rows, up.columns, includeAll, F.makeIndex(D));
  }
  var CsvControl = createClass({
    getInitialState: function () { return {busy: false, err: ''}; },
    isValid: function () { var v = js(this.props.value); return v && v.rows && v.rows.length ? true : {error: {message: 'Choose a CSV file to upload.'}}; },
    file: function (ev) {
      var self = this, file = ev.target.files && ev.target.files[0]; if (!file) return;
      this.setState({busy: true, err: ''});
      window.Papa.parse(file, {header: true, skipEmptyLines: 'greedy', complete: function (res) {
        var cols = (res.meta.fields || []).filter(function (c) { return c != null && String(c).trim() !== ''; });
        if (!cols.length) { self.setState({busy: false, err: 'That file has no header row.'}); return; }
        self.setState({busy: false});
        self.props.onChange({include_all: !!(js(self.props.value) || {}).include_all, filename: file.name, uploaded: new Date().toISOString().slice(0, 10), columns: cols, rows: res.data});
      }, error: function (e) { self.setState({busy: false, err: String(e && e.message || e)}); }});
    },
    template: function () {
      var blob = new Blob([F.templateCsv(D)], {type: 'text/csv'}), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'net-zero-tracker-template.csv'; a.click();
    },
    render: function () {
      var self = this, v = js(this.props.value), inc = !!(v && v.include_all);
      var s = summarize(v, inc);
      return h('div', {className: 'nzw'},
        h('div', {className: 'row'},
          h('input', {type: 'file', accept: '.csv,text/csv', onChange: this.file, style: {maxWidth: '340px'}}),
          h('button', {type: 'button', className: 'btn', onClick: this.template}, 'Download a CSV template')),
        h('label', {style: {display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '12px 0 4px', fontWeight: 600, cursor: 'pointer'}},
          h('input', {type: 'checkbox', checked: inc, style: {width: 'auto', marginTop: '3px'}, onChange: function (ev) { self.props.onChange(Object.assign({}, v || {}, {include_all: ev.target.checked})); }}),
          h('span', null, 'Include every column in the file (all dataset fields), not just the fields the site shows', h('span', {className: 'muted', style: {display: 'block', fontWeight: 400, fontSize: '13px'}}, 'Extra columns are kept with each entry and listed under "All data fields" on its profile.'))),
        h('p', {className: 'muted', style: {fontSize: '13px'}}, 'Column names can be the field codes in the template (n, t, cn …) or their labels (Name, Type, Country …). Include an ID column (s) to update an existing entry; otherwise rows are matched by Name and Type.'),
        this.state.busy ? h('p', null, 'Reading the file…') : null,
        this.state.err ? h('p', {className: 'bad'}, this.state.err) : null,
        s ? h('div', {className: 'card'},
          h('b', null, v.filename + ': ' + v.rows.length + ' rows'),
          h('p', null, h('span', {className: 'ok'}, s.stats.updated + ' existing entries will be updated'), ', ', h('b', null, s.stats.added + ' new entries added'),
            s.stats.skipped ? h('span', {className: 'bad'}, ', ' + s.stats.skipped + ' rows skipped') : null, '.'),
          h('p', null, 'Recognised columns: ', h('span', {className: 'chips'}, v.columns.filter(function (c) { return F.columnField(c); }).map(function (c) { return h('span', {key: c}, c); }))),
          s.unknown.length ? h('p', null, inc ? 'Extra columns (kept, because "Include every column" is on): ' : 'Columns that will be ignored (turn on "Include every column" to keep them): ',
            h('span', {className: 'chips'}, s.unknown.slice(0, 60).map(function (c) { return h('span', {key: c}, c); })), s.unknown.length > 60 ? ' and ' + (s.unknown.length - 60) + ' more' : null) : null,
          s.problems.length ? h('div', {className: 'bad'}, s.problems.slice(0, 15).map(function (p, i) { return h('div', {key: i}, p); })) : null,
          h('p', {className: 'muted', style: {margin: 0}}, 'Nothing changes on the site until this upload is reviewed and published. Use the preview to look at any affected profile.')) : null);
    }
  });
  CMS.registerWidget('nzt-csv', CsvControl, function () { return h('div', null); });

  /* ================= Live preview ================= */
  var DEVICES = [['Desktop', 1280], ['Tablet', 820], ['Mobile', 390]];
  var dev = 0; try { dev = +(localStorage.getItem('nzt-cms-device') || 0); } catch (e) {}

  function makePreview(kind) {
    return createClass({
      getInitialState: function () { return {dev: dev, w: 600, h: 800, pick: ''}; },
      componentDidMount: function () {
        var self = this, win = this.box.ownerDocument.defaultView;
        if (kind === 'text') { try { sessionStorage.removeItem('nzt-cms-draft'); } catch (e) {} }
        this.measure = function () { if (self.box) self.setState({w: self.box.clientWidth, h: win.innerHeight - 52}); };
        win.addEventListener('resize', this.measure); this.measure();
        this.frame.addEventListener('load', function () { self.ready = true; self.post(true); });
        this.frame.src = SITE + '?cmspreview=1' + this.hash();
      },
      componentWillUnmount: function () { this.box && this.box.ownerDocument.defaultView.removeEventListener('resize', this.measure); clearTimeout(this.t); },
      componentDidUpdate: function () { var self = this; clearTimeout(this.t); this.t = setTimeout(function () { self.post(false); }, kind === 'text' ? 150 : 700); },
      data: function () { return js(this.props.entry.get('data')) || {}; },
      changed: function () {
        var d = this.data();
        if (kind === 'record') { var r = d.record || {}; return r.s ? [d.remove ? {s: r.s, _delete: true} : r] : []; }
        if (kind === 'import') { var s = summarize(d.upload, !!(d.upload && d.upload.include_all)); return s ? s.patches : []; }
        return [];
      },
      hash: function () {
        var d = this.data();
        if (kind === 'text') return d.route || '#/';
        var p = this.changed(), s = this.state.pick || (p[0] && p[0].s);
        return s ? '#/e/' + encodeURIComponent(s) : '#/explore';
      },
      post: function (first) {
        if (!this.ready || !this.frame.contentWindow) return;
        var w = this.frame.contentWindow, d = this.data();
        if (kind === 'text') {
          var blocks = (d.blocks || []).map(function (b) { return {orig: b.orig, text: b.text == null ? b.start : b.text}; }), prev = this.lastBlocks || {}, diff = [];
          blocks.forEach(function (b) { if (prev[b.orig] !== undefined && prev[b.orig] !== b.text) diff.push(b.orig); });
          var lb = this.lastBlocks = {}; blocks.forEach(function (b) { lb[b.orig] = b.text; });
          w.postMessage({nztcms: 1, type: 'text', blocks: blocks, focus: diff.length === 1 ? diff[0] : null}, location.origin);
        } else {
          var key = JSON.stringify(this.changed()) + this.hash();
          if (key === this.lastKey) return;
          if (first && this.lastKey === undefined) { this.lastKey = key; w.postMessage({nztcms: 1, type: 'data', patches: this.changed(), hash: this.hash()}, location.origin); return; }
          this.lastKey = key; this.ready = false;
          w.postMessage({nztcms: 1, type: 'data', patches: this.changed(), hash: this.hash()}, location.origin);
        }
      },
      setDev: function (i) { dev = i; try { localStorage.setItem('nzt-cms-device', i); } catch (e) {} this.setState({dev: i}); },
      render: function () {
        var self = this, W = DEVICES[this.state.dev][1], sc = Math.min(1, (this.state.w - 24) / W), H = Math.max(400, this.state.h);
        var bar = {display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', borderBottom: '1px solid #e3dfe8', background: '#faf9fb', font: '14px system-ui,sans-serif', position: 'sticky', top: 0, zIndex: 2};
        var btn = function (on) { return {font: 'inherit', fontWeight: 600, border: '1px solid ' + (on ? '#271039' : '#cfcad6'), background: on ? '#271039' : '#fff', color: on ? '#fff' : '#271039', borderRadius: '99px', padding: '4px 12px', cursor: 'pointer'}; };
        var picker = null;
        if (kind !== 'text') {
          var p = this.changed();
          if (p.length > 1) picker = h('select', {value: this.state.pick || (p[0] && p[0].s), style: {font: 'inherit', maxWidth: '260px'}, onChange: function (ev) { self.setState({pick: ev.target.value}, function () { self.ready = true; self.lastKey = null; self.post(false); }); }},
            p.slice(0, 300).map(function (x) { var e = BY[x.s]; return h('option', {key: x.s, value: x.s}, (x.n || (e && e.n) || x.s) + (e ? '' : ' (new)')); }));
        }
        return h('div', {ref: function (el) { self.box = el; }, style: {minHeight: '100vh', background: '#ece9f0'}},
          h('div', {style: bar},
            DEVICES.map(function (d, i) { return h('button', {key: d[0], type: 'button', style: btn(i === self.state.dev), onClick: function () { self.setDev(i); }}, d[0]); }),
            h('span', {style: {color: '#6b6475', fontSize: '12.5px', marginLeft: '4px'}}, W + 'px' + (sc < 1 ? ' · shown at ' + Math.round(sc * 100) + '%' : '')),
            picker,
            kind !== 'text' && this.changed().length === 0 ? h('span', {style: {color: '#6b6475'}}, 'Choose or upload entries to preview them.') : null),
          h('div', {style: {width: W * sc + 'px', height: H + 'px', margin: '12px auto', overflow: 'hidden', borderRadius: this.state.dev ? '18px' : '6px', boxShadow: '0 2px 14px rgba(39,16,57,.18)', background: '#fff', border: this.state.dev === 2 ? '8px solid #271039' : 'none', boxSizing: 'content-box'}},
            h('iframe', {ref: function (el) { self.frame = el; }, title: 'Live preview', style: {width: W + 'px', height: H / sc + 'px', border: 0, transform: 'scale(' + sc + ')', transformOrigin: '0 0', display: 'block'}})));
      }
    });
  }
  var TextPreview = makePreview('text');
  ['site', 'home', 'explore', 'profile', 'compare', 'goodnet', 'learn', 'policymakers', 'advocates', 'analysis', 'insights', 'methodology', 'volunteering', 'news', 'about', 'team', 'faqs', 'data-terms', 'terms', 'notes']
    .forEach(function (n) { CMS.registerPreviewTemplate(n, TextPreview); });
  CMS.registerPreviewTemplate('records', makePreview('record'));
  CMS.registerPreviewTemplate('imports', makePreview('import'));
})();
