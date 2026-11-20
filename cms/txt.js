/* Net Zero Tracker prototype: content layer for the CMS.
   - Applies edited page text (window.NZT_CMS.text, built from the private content repo) to whatever the app renders.
   - Applies data edits and CSV imports (window.NZT_CMS.patches) to window.NZT before app.js starts.
   - In the editor's preview (?cmspreview=1) it also accepts unsaved drafts from the editor by postMessage.
   The app's own code is never changed: text is matched by its original HTML, segment by segment. */
(function () {
  'use strict';
  var CMS = window.NZT_CMS || {text: {}, patches: []};
  var PREVIEW = /[?&]cmspreview=1/.test(location.search);

  /* ---------- markdown-lite: **bold**, *italic*, [link](url), line breaks ---------- */
  var escH = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var escA = function (s) { return escH(s).replace(/"/g, '&quot;'); };
  function mdToHtml(md) {
    var s = escH(String(md).trim());
    s = s.replace(/&lt;(\/?)(sup|sub)&gt;/g, '<$1$2>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
      u = u.replace(/&amp;/g, '&');
      if (!/^(https?:|mailto:|#|\/)/.test(u)) return t;
      var ext = /^https?:/.test(u);
      return '<a href="' + escA(u) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
    return s.replace(/\n/g, '<br>');
  }
  function htmlToMd(html) {
    var d = document.createElement('div'); d.innerHTML = html;
    var walk = function (n) {
      if (n.nodeType === 3) return n.data;
      if (n.nodeType !== 1) return '';
      var t = n.tagName.toLowerCase(), inner = Array.prototype.map.call(n.childNodes, walk).join('');
      if (t === 'b' || t === 'strong') return '**' + inner + '**';
      if (t === 'i' || t === 'em') return '*' + inner + '*';
      if (t === 'a') return '[' + inner + '](' + n.getAttribute('href') + ')';
      if (t === 'br') return '\n';
      if (t === 'sup' || t === 'sub') return '<' + t + '>' + inner + '</' + t + '>';
      return inner;
    };
    return Array.prototype.map.call(d.childNodes, walk).join('').replace(/[ \t\r\f\v]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }

  /* ---------- segments: runs of text + simple inline tags inside one element ---------- */
  var SKIP = {SCRIPT: 1, STYLE: 1, SVG: 1, svg: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, TEMPLATE: 1, IFRAME: 1};
  var SKIP_SEL = 'tbody,.sugg,.tip,#toast,[data-cms-skip]';
  var INLINE = {B: 1, STRONG: 1, I: 1, EM: 1, A: 1, BR: 1, SUP: 1, SUB: 1};
  var A_OK = {href: 1, target: 1, rel: 1};
  function isInline(n) {
    if (n.nodeType === 3) return true;
    if (n.nodeType !== 1 || !INLINE[n.tagName]) return false;
    for (var i = 0; i < n.attributes.length; i++) {
      if (n.tagName !== 'A' || !A_OK[n.attributes[i].name]) return false;
    }
    for (var c = n.firstChild; c; c = c.nextSibling) if (!isInline(c)) return false;
    return true;
  }
  var ser = function (n) { return n.nodeType === 3 ? escH(n.data) : n.outerHTML; };
  var norm = function (s) { return s.replace(/\s+/g, ' ').trim(); };
  // calls fn(nodes, key) for each segment under root
  function eachSegment(root, fn) {
    var visit = function (el) {
      if (SKIP[el.tagName] || el.namespaceURI === 'http://www.w3.org/2000/svg') return;
      if (el.matches && el.matches(SKIP_SEL)) return;
      var run = [];
      var flush = function () {
        if (!run.length) return;
        var key = norm(run.map(ser).join(''));
        var text = norm(run.map(function (n) { return n.textContent; }).join(''));
        if (/[A-Za-zÀ-ɏ]{2}/.test(text)) fn(run.slice(), key, text);
        run = [];
      };
      var kids = Array.prototype.slice.call(el.childNodes);
      kids.forEach(function (n) {
        if (n.nodeType === 8) return;
        if (isInline(n)) run.push(n); else { flush(); if (n.nodeType === 1) visit(n); }
      });
      flush();
    };
    visit(root);
  }

  /* ---------- applying text edits ---------- */
  var OV = {};                       // original key -> replacement html
  Object.keys(CMS.text || {}).forEach(function (k) { OV[k] = mdToHtml(CMS.text[k]); });
  var applying = false, FOCUS = null;
  function focusOn(el) {
    document.querySelectorAll('.cms-hl').forEach(function (x) { x.classList.remove('cms-hl'); });
    el.classList.add('cms-hl'); el.scrollIntoView({block: 'center'});
  }
  function apply(root) {
    if (!root) return;
    applying = true;
    eachSegment(root, function (nodes, key) {
      var rep = OV[key];
      if (FOCUS && key === FOCUS) { var host = nodes[0].parentElement; FOCUS = null; if (host) setTimeout(function () { focusOn(host); }, 0); }
      if (rep == null || norm(rep) === key) return;
      var first = nodes[0], parent = first.parentNode;
      var lead = /^\s/.test(ser(first)) ? ' ' : '', trail = /\s$/.test(ser(nodes[nodes.length - 1])) ? ' ' : '';
      var tmp = document.createElement('template'); tmp.innerHTML = lead + rep + trail;
      var marker = document.createComment('cms');
      parent.insertBefore(marker, first);
      nodes.forEach(function (n) { parent.removeChild(n); });
      parent.insertBefore(tmp.content, marker);
      parent.removeChild(marker);
    });
    applying = false;
  }
  var CHROME = ['header.site', 'footer.site', '.partners', '.proto', '#nlbox'];
  var chromeOrig = null;
  function applyChrome() {
    var els = CHROME.map(function (s) { return document.querySelector(s); });
    if (!chromeOrig) chromeOrig = els.map(function (el) { return el ? el.innerHTML : null; });
    else els.forEach(function (el, i) { if (el && chromeOrig[i] != null && PREVIEW) el.innerHTML = chromeOrig[i]; });
    els.forEach(apply);
  }

  /* ---------- extra fields from "include every column" imports, shown on the profile ---------- */
  function extraFields() {
    var m = location.hash.match(/^#\/e\/([^/?]+)/), main = document.getElementById('main');
    if (!m || !main || main.querySelector('.cms-extra')) return;
    var e = (window.NZT || []).find(function (x) { return x.s === decodeURIComponent(m[1]); });
    if (!e || !e.x || !Object.keys(e.x).length) return;
    var rows = Object.keys(e.x).map(function (k) { return '<tr><th scope="row">' + escH(k) + '</th><td>' + escH(e.x[k]) + '</td></tr>'; }).join('');
    var sec = document.createElement('section'); sec.className = 'tight cms-extra'; sec.setAttribute('data-cms-skip', '');
    sec.innerHTML = '<div class="wrap"><details class="card"><summary><b>All data fields</b> <span class="muted">(' + Object.keys(e.x).length + ' fields from the latest data upload)</span></summary><div class="tablewrap" style="margin-top:12px"><table class="cms-xt">' + rows + '</table></div></details></div>';
    main.appendChild(sec);
  }

  var queued = false;
  function schedule() {
    if (queued || applying) return; queued = true;
    (window.requestAnimationFrame || setTimeout)(function () { queued = false; apply(document.getElementById('main')); extraFields(); });
  }
  function start() {
    var st = document.createElement('style');
    st.textContent = '.cms-xt{border-collapse:collapse;width:100%;font-size:14px}.cms-xt th,.cms-xt td{text-align:left;padding:6px 10px;border-top:1px solid var(--line,#ddd);vertical-align:top}.cms-xt th{font-weight:600;width:38%;color:var(--ink-2,#333)}.cms-extra summary{cursor:pointer}' +
      '.cms-preview #nlbox{display:none!important}.cms-hl{outline:3px solid #FAA542!important;outline-offset:3px;border-radius:3px}';
    document.head.appendChild(st);
    var main = document.getElementById('main');
    if (main && window.MutationObserver) new MutationObserver(function () { if (!applying) schedule(); }).observe(main, {childList: true, subtree: true, characterData: true});
    applyChrome(); schedule();
  }

  /* ---------- data patches (run now, before app.js reads window.NZT) ---------- */
  var NUM = {pop: 1, gdp: 1, rev: 1, ghg: 1, po: 1};
  function patchData(list) {
    var D = window.NZT; if (!D || !list || !list.length) return;
    var by = {}; D.forEach(function (e) { by[e.s] = e; });
    list.forEach(function (p) {
      if (!p || !p.s) return;
      var e = by[p.s];
      if (p._delete) { if (e) D.splice(D.indexOf(e), 1); delete by[p.s]; return; }
      if (!e) { e = {s: p.s}; D.push(e); by[p.s] = e; }
      Object.keys(p).forEach(function (k) {
        if (k === 's' || k === '_delete') return;
        var v = p[k];
        if (k === 'x') { e.x = Object.assign(e.x || {}, v); return; }
        if (v === '' || v == null) { delete e[k]; return; }
        e[k] = NUM[k] ? +v : v;
      });
    });
  }
  patchData(CMS.patches);

  /* ---------- editor preview ---------- */
  if (PREVIEW) {
    var draft = null;
    try { draft = JSON.parse(sessionStorage.getItem('nzt-cms-draft') || 'null'); } catch (e) {}
    if (draft && draft.patches) patchData(draft.patches);
    if (draft && draft.text) Object.keys(draft.text).forEach(function (k) { OV[k] = mdToHtml(draft.text[k]); });
    document.documentElement.classList.add('cms-preview');
    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin || !ev.data || ev.data.nztcms !== 1) return;
      var m = ev.data;
      if (m.type === 'text') {
        (m.blocks || []).forEach(function (b) { OV[b.orig] = mdToHtml(b.text); });
        FOCUS = m.focus || null;
        applyChrome();
        var y = window.scrollY;
        window.dispatchEvent(new HashChangeEvent('hashchange'));   // re-render the page from the app's own source, then re-apply
        window.scrollTo(0, y);
      } else if (m.type === 'data') {
        try { sessionStorage.setItem('nzt-cms-draft', JSON.stringify({patches: m.patches || []})); } catch (e) {}
        if (m.hash && location.hash !== m.hash) location.hash = m.hash;
        location.reload();
      } else if (m.type === 'route') {
        if (location.hash !== m.hash) location.hash = m.hash;
      }
    });
    // keep links inside the preview
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[target="_blank"]');
      if (a) { ev.preventDefault(); }
    }, true);
  }

  window.NZTCMS = {mdToHtml: mdToHtml, htmlToMd: htmlToMd, eachSegment: eachSegment, norm: norm, patchData: patchData};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
