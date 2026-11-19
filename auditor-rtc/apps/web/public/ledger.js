/*! Ledger UI runtime v2 — vanilla JS, no dependencies, safe under the artifact CSP.
   Sections: util · theme · tab (favicon + title) · motion · verbs · roll · url chips · toast · tabs · delegates · init
   Contract: if anything throws, every reveal target gets .is-in so the page is never left hidden. */
(function () {
  'use strict';
  var W = window, D = document, R = D.documentElement;
  var L = (W.Ledger = W.Ledger || {});
  L.version = '2.0.0';
  L.config = { faviconSrc: null };   // (host) => image URL | null. Leave null inside published artifacts (CSP blocks remote images).

  function mq(q) { return W.matchMedia ? W.matchMedia(q) : { matches: false }; }
  var RM = mq('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function safe(fn) { try { fn(); } catch (e) { if (W.console) console.warn('[ledger]', e); } }
  L.icon = function (name, size) { return '<svg class="i' + (size ? ' i--' + size : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; };

  /* Polite live region — one place for screen-reader announcements (verbs, async results). */
  L.say = function (msg) {
    var r = $('#ledger-live');
    if (!r) { r = el('div', 'sr-only'); r.id = 'ledger-live'; r.setAttribute('role', 'status'); r.setAttribute('aria-live', 'polite'); D.body.appendChild(r); }
    r.textContent = ''; setTimeout(function () { r.textContent = msg; }, 60);
  };

  /* ── theme: auto → light → dark ───────────────────────────────────────────── */
  var TKEY = 'ledger-theme';
  L.theme = {
    get: function () { try { return localStorage.getItem(TKEY) || 'auto'; } catch (e) { return 'auto'; } },
    effective: function () { return R.getAttribute('data-theme') || (mq('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); },
    set: function (m) {
      if (m === 'auto') R.removeAttribute('data-theme'); else R.setAttribute('data-theme', m);
      try { if (m === 'auto') localStorage.removeItem(TKEY); else localStorage.setItem(TKEY, m); } catch (e) {}
      L.theme.label(); if (L.tab) L.tab.refresh();
    },
    label: function () {
      var m = L.theme.get();
      $$('[data-theme-toggle]').forEach(function (b) { b.setAttribute('aria-label', 'Theme: ' + m + '. Change theme'); b.title = 'Theme: ' + m; });
    },
    cycle: function () { var o = ['auto', 'light', 'dark']; L.theme.set(o[(o.indexOf(L.theme.get()) + 1) % 3]); }
  };

  /* ── tab: dynamic favicon + document title ────────────────────────────────── */
  var FAV = { light: { bg: '#17140F', fg: '#F1EEE5', live: '#B9CC3E', err: '#C9591F' }, dark: { bg: '#EDE9DE', fg: '#151310', live: '#C9D95F', err: '#E07A3C' } };
  L.tab = {
    state: 'idle',
    letter: function () {
      var m = $('meta[name="ledger:letter"]'), b = $('.brand__mark');
      return ((m && m.content) || (b && b.textContent) || 'L').trim().charAt(0).toUpperCase();
    },
    product: function () { var m = $('meta[name="ledger:product"]'); return m ? m.content : ''; },
    svg: function (state) {
      var c = FAV[mq('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'];   // browser chrome follows the OS, not the page theme
      var dot = state === 'live' ? c.live : state === 'error' ? c.err : null;
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="' + c.bg + '"/>' +
        '<text x="16" y="24" text-anchor="middle" font-family="Archivo,Arial Black,Arial,sans-serif" font-weight="800" font-size="22" fill="' + c.fg + '">' + esc(L.tab.letter()) + '</text>' +
        (dot ? '<circle cx="25" cy="7" r="6" fill="' + dot + '" stroke="' + c.bg + '" stroke-width="2"/>' : '') + '</svg>';
    },
    refresh: function () {
      var old = $('link[rel="icon"][type="image/svg+xml"]'), n = el('link');
      n.rel = 'icon'; n.type = 'image/svg+xml'; n.href = 'data:image/svg+xml,' + encodeURIComponent(L.tab.svg(L.tab.state));
      if (old && old.parentNode) old.parentNode.replaceChild(n, old); else D.head.appendChild(n);   // replacing the node forces browsers to repaint the tab icon
    },
    set: function (o) {
      o = o || {};
      if (o.state) L.tab.state = o.state;
      if (o.title != null) { var p = L.tab.product(); D.title = o.title + (p ? ' | ' + p : ''); }
      L.tab.refresh();
    }
  };

  /* ── motion ───────────────────────────────────────────────────────────────── */
  function fallbackVisible() { $$('[data-reveal],[data-reveal-group],.eyebrow,.rail,.chart-wrap').forEach(function (n) { n.classList.add('is-in'); }); }
  var io = null;
  function setupCount(n) {
    if (n.__ct || RM) return; n.__ct = 1;
    var m = /^(\D*)([\d.,]+)(\D*)$/.exec(n.textContent.trim()); if (!m) return;
    var pre = n.getAttribute('data-prefix') != null ? n.getAttribute('data-prefix') : m[1];
    var suf = n.getAttribute('data-suffix') != null ? n.getAttribute('data-suffix') : m[3];
    var to = n.getAttribute('data-count') ? parseFloat(n.getAttribute('data-count')) : parseFloat(m[2].replace(/,/g, ''));
    var dec = n.getAttribute('data-decimals') != null ? +n.getAttribute('data-decimals') : (m[2].split('.')[1] || '').length;
    var delay = +(n.getAttribute('data-delay') || 450), dur = 1300, finalText = n.textContent;
    function fmt(v) { return pre + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; }
    n.textContent = fmt(0);   // static final text lives in the markup; reset happens under the block's fade-in
    function run() {
      setTimeout(function () {
        var t0 = null;
        requestAnimationFrame(function step(ts) {
          if (t0 === null) t0 = ts;
          var p = Math.min(1, (ts - t0) / dur);
          n.textContent = p < 1 ? fmt(to * (1 - Math.pow(1 - p, 3))) : finalText;
          if (p < 1) requestAnimationFrame(step);
        });
      }, delay);
    }
    if ('IntersectionObserver' in W) {
      var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { o.disconnect(); run(); } }, { threshold: .3 });
      o.observe(n);
    } else n.textContent = finalText;
  }
  var nudge = function () {};
  function parallaxTilt() {
    if (RM) return;
    var items = $$('[data-parallax],[data-tilt]').map(function (n) {
      return { n: n, f: parseFloat(n.getAttribute('data-parallax')) || 0, tilt: n.hasAttribute('data-tilt'), py: 0, rx: 0, ry: 0, tX: 0, tY: 0 };
    });
    if (!items.length) return;
    var raf = 0, fine = mq('(hover: hover) and (pointer: fine)').matches;
    function ready(n) { return !n.classList.contains('reveal') || n.classList.contains('revealed'); }   // load animation must release before JS owns transform
    function frame() {
      raf = 0; var vh = W.innerHeight, again = false;
      items.forEach(function (it) {
        if (!ready(it.n)) { again = true; return; }
        var r = it.n.getBoundingClientRect(); if (!r.height) return;
        if (it.f) it.py = (r.top + r.height / 2 - it.py - vh / 2) * it.f;   // subtract our own offset so the read is stable
        if (it.tilt) {
          it.rx += (it.tX - it.rx) * .12; it.ry += (it.tY - it.ry) * .12;
          if (Math.abs(it.tX - it.rx) > .01 || Math.abs(it.tY - it.ry) > .01) again = true;
        }
        it.n.style.transform = 'translate3d(0,' + it.py.toFixed(2) + 'px,0)' +
          (it.tilt ? ' perspective(1200px) rotateX(' + it.rx.toFixed(3) + 'deg) rotateY(' + it.ry.toFixed(3) + 'deg)' : '');   // ONE transform string per element
      });
      if (again) raf = requestAnimationFrame(frame);
    }
    nudge = function () { if (!raf) raf = requestAnimationFrame(frame); };
    W.addEventListener('scroll', nudge, { passive: true }); W.addEventListener('resize', nudge);
    if (fine) items.forEach(function (it) {
      if (!it.tilt) return;
      it.n.addEventListener('pointermove', function (e) {
        var r = it.n.getBoundingClientRect();
        it.tY = ((e.clientX - r.left) / r.width - .5) * 5; it.tX = -((e.clientY - r.top) / r.height - .5) * 5;   // ±2.5°
        nudge();
      });
      it.n.addEventListener('pointerleave', function () { it.tX = 0; it.tY = 0; nudge(); });
    });
    nudge();
  }
  function progress() {
    var b = $('.progress'); if (!b) return;
    function tick() { var h = R.scrollHeight - W.innerHeight; b.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, W.scrollY / h) : 0) + ')'; }
    W.addEventListener('scroll', tick, { passive: true }); W.addEventListener('resize', tick); tick();
  }
  L.motion = {
    init: function () { try { progress(); L.motion.scan(D); parallaxTilt(); } catch (e) { fallbackVisible(); } },
    refresh: function () { nudge(); },   // call after showing a hidden view
    scan: function (root) {
      root = root || D;
      var targets = $$('[data-reveal],[data-reveal-group],.eyebrow,.rail,.chart-wrap', root);
      if (RM || !('IntersectionObserver' in W)) targets.forEach(function (t) { t.classList.add('is-in'); });
      else {
        io = io || new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { threshold: .08, rootMargin: '0px 0px -4% 0px' });
        targets.forEach(function (t) { if (!t.__lo) { t.__lo = 1; io.observe(t); } });
      }
      $$('.reveal', root).forEach(function (n) {
        if (n.__rv) return; n.__rv = 1;
        n.addEventListener('animationend', function (e) { if (e.target === n) n.classList.add('revealed'); });   // release fill-mode:forwards so JS can own transform
      });
      $$('.count', root).forEach(setupCount);
    }
  };

  /* ── spinning verbs: a wait state that names the work ─────────────────────── */
  var VERBS = {   // [present, past] — bookkeeping and audit vocabulary; past form closes the entry
    data:  [['Tallying', 'Tallied'], ['Footing', 'Footed'], ['Casting', 'Cast'], ['Vouching', 'Vouched'], ['Reconciling', 'Reconciled'], ['Balancing', 'Balanced'], ['Ticking', 'Ticked'], ['Netting', 'Netted']],
    auth:  [['Verifying', 'Verified'], ['Matching', 'Matched'], ['Checking', 'Checked'], ['Unsealing', 'Unsealed']],
    agent: [['Routing', 'Routed'], ['Weighing', 'Weighed'], ['Trimming', 'Trimmed'], ['Pricing', 'Priced'], ['Counting', 'Counted'], ['Caching', 'Cached']],
    file:  [['Ruling', 'Ruled'], ['Binding', 'Bound'], ['Stamping', 'Stamped'], ['Filing', 'Filed']]
  };
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmtT(s) { return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + ('0' + (s % 60)).slice(-2) + 's'; }

  L.verbs = {
    sets: VERBS,
    /* start(host, {set, first, delay=400, cycle=1600, minShow=600, elapsed=true, keep, linger, label, onShow}) → {done, fail, stop} */
    start: function (host, o) {
      o = o || {};
      var pairs = Array.isArray(o.set) ? o.set : (VERBS[o.set || host.getAttribute('data-verbs')] || VERBS.data);
      var deck = shuffle(pairs);
      if (o.first) deck.sort(function (a, b) { return (b[0] === o.first) - (a[0] === o.first); });
      var i = 0, delay = o.delay != null ? o.delay : 400, cycle = o.cycle || 1600, minShow = o.minShow != null ? o.minShow : 600;
      var maxLen = deck.reduce(function (m, p) { return Math.max(m, p[0].length, p[1].length); }, 0);
      var t0 = Date.now(), shownAt = 0, timers = [], ended = false;

      host.classList.add('verb'); host.classList.remove('verb--done', 'verb--fail', 'verb--run');
      host.setAttribute('data-pending', ''); host.style.setProperty('--verb-w', (maxLen + 1) + 'ch');
      host.innerHTML = '<span class="verb__sq" aria-hidden="true"></span>' +
        '<span class="verb__lbl" aria-hidden="true"><span class="verb__text"></span><span class="verb__dots">...</span></span>' +
        (o.elapsed === false ? '' : '<span class="verb__t" aria-hidden="true">0s</span>');
      var txt = $('.verb__text', host), sq = $('.verb__sq', host), tEl = $('.verb__t', host), lbl = $('.verb__lbl', host);

      function put(word, animate) {
        var s = el('span', '', word), old = txt.firstChild;
        if (animate && !RM && old && old.animate) {
          txt.appendChild(s);
          var ease = 'cubic-bezier(.2,.7,.2,1)';
          old.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], { duration: 240, easing: ease, fill: 'forwards' })
            .onfinish = function () { if (old.parentNode) old.parentNode.removeChild(old); };
          s.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 240, easing: ease });
        } else { txt.textContent = ''; txt.appendChild(s); }
      }
      function clear() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; }
      function show() {
        shownAt = Date.now(); host.removeAttribute('data-pending'); host.classList.add('verb--run');
        put(deck[0][0], false); L.say(o.label || 'Working'); if (o.onShow) o.onShow();
        if (!RM && deck.length > 1) timers.push(setInterval(function () { i = (i + 1) % deck.length; put(deck[i][0], true); }, cycle));   // reduced motion: hold the first verb
        if (tEl) timers.push(setInterval(function () { tEl.textContent = fmtT(Math.floor((Date.now() - t0) / 1000)); }, 1000));
      }
      if (delay <= 0) show(); else timers.push(setTimeout(show, delay));   // under `delay` ms nothing renders — no flash on fast responses

      function finish(kind, msg) {
        if (ended) return Promise.resolve();
        ended = true;
        var wait = shownAt ? Math.max(0, minShow - (Date.now() - shownAt)) : 0;   // once visible, stay visible long enough to be read
        return new Promise(function (res) {
          setTimeout(function () {
            clear(); host.classList.remove('verb--run');
            if (!shownAt) { host.innerHTML = ''; host.removeAttribute('data-pending'); return res(false); }
            var ok = kind === 'done', word = ok ? (msg || deck[i][1]) : (msg || 'Failed');
            sq.className = 'verb__flag'; sq.textContent = ok ? '✓' : '✕';
            host.classList.add(ok ? 'verb--done' : 'verb--fail');
            lbl.innerHTML = ''; lbl.appendChild(el('span', '', word)); if (tEl) tEl.parentNode.removeChild(tEl);
            L.say(word);
            if (!ok) return res(true);   // errors stay on screen until the person acts
            setTimeout(function () { if (!o.keep) host.innerHTML = ''; res(true); }, o.linger != null ? o.linger : 1400);
          }, wait);
        });
      }
      return {
        done: function (word) { return finish('done', word); },
        fail: function (msg) { return finish('fail', msg); },
        stop: function () { ended = true; clear(); host.innerHTML = ''; host.removeAttribute('data-pending'); host.classList.remove('verb--run'); }
      };
    },
    /* button(btn, promiseOrFn, {set, done, delay=120}) — swaps the label for a verb while `work` runs; resolves with work's value */
    button: function (btn, work, o) {
      o = o || {};
      var html = btn.innerHTML, lab = el('span', '', html), slot = el('span', 'verb--btn');
      btn.style.minWidth = btn.getBoundingClientRect().width + 'px';   // no width jump when the label swaps
      btn.setAttribute('aria-busy', 'true'); btn.setAttribute('aria-disabled', 'true');
      btn.innerHTML = ''; btn.appendChild(lab); btn.appendChild(slot);
      var run = L.verbs.start(slot, { set: o.set, delay: o.delay != null ? o.delay : 120, elapsed: false, keep: true, linger: o.linger != null ? o.linger : 700, onShow: function () { lab.hidden = true; } });
      function restore() { btn.innerHTML = html; btn.style.minWidth = ''; btn.removeAttribute('aria-busy'); btn.removeAttribute('aria-disabled'); }
      return Promise.resolve(typeof work === 'function' ? work() : work).then(
        function (v) { return run.done(o.done).then(function () { restore(); return v; }); },
        function (err) { run.stop(); restore(); throw err; });
    }
  };

  /* ── verb roller: a headline word that cycles once, then settles ──────────── */
  L.roll = function (root) {
    $$('[data-roll]', root || D).forEach(function (n) {
      if (n.__roll) return; n.__roll = 1;
      var words = n.getAttribute('data-roll').split('|'), rest = n.textContent.trim();
      var loops = +(n.getAttribute('data-roll-loops') || 1), every = +(n.getAttribute('data-roll-every') || 2400), lead = +(n.getAttribute('data-roll-delay') || 1800);
      if (RM || words.length < 2) return;   // static: the markup already holds the resting word
      var ri = Math.max(0, words.indexOf(rest));
      n.textContent = ''; n.appendChild(el('span', 'sr-only', rest));
      var els = words.map(function (w) { var s = el('span', 'roll__w', w); s.setAttribute('aria-hidden', 'true'); n.appendChild(s); return s; });
      var cur = els[ri], z = 1, seq = [], k, j; cur.classList.add('is-on');
      for (k = 0; k < loops; k++) for (j = 1; j <= words.length; j++) seq.push((ri + j) % words.length);   // walks the others, lands back on the resting word
      var step = 0;
      function next() {
        if (step >= seq.length) return;
        var nx = els[seq[step++]], prev = cur;
        nx.style.zIndex = ++z; nx.classList.add('is-on', 'is-fresh'); cur = nx;
        setTimeout(function () { prev.classList.remove('is-on', 'is-fresh'); }, 560);
        setTimeout(next, every);
      }
      setTimeout(next, lead);   // the resting word is readable first; the hero's own load sequence plays before any roll
    });
  };

  /* ── url chips: favicon tile + emphasised host ────────────────────────────── */
  L.urlChip = function (root) {
    $$('a[data-url-chip]', root || D).forEach(function (a) {
      if (a.__uc) return; a.__uc = 1;
      var u; try { u = new URL(a.getAttribute('href'), D.baseURI); } catch (e) { return; }
      var h = u.hostname.replace(/^www\./, ''), path = (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash, parts = h.split('.'), n = parts.length;
      var core = (n > 2 && parts[n - 1].length <= 3 && parts[n - 2].length <= 3) ? parts[n - 3] : (parts[n - 2] || h);   // handles co.uk / com.br
      a.className = (a.className + ' url').trim(); a.title = u.href;
      if (u.origin !== W.location.origin) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      var tile = el('span', 'tile'); tile.setAttribute('aria-hidden', 'true'); tile.textContent = core.charAt(0);
      var src = L.config.faviconSrc ? L.config.faviconSrc(h) : null;
      if (src) { var img = new Image(); img.alt = ''; img.width = 16; img.height = 16; img.onload = function () { tile.textContent = ''; tile.appendChild(img); }; img.src = src; }   // on error the letter stays
      a.textContent = ''; a.appendChild(tile);
      var host = el('span', 'url__host'); host.textContent = h; a.appendChild(host);
      if (path) { var p = el('span', 'url__path'); p.textContent = path; a.appendChild(p); }
      a.insertAdjacentHTML('beforeend', L.icon('arrow-up-right'));
    });
  };

  /* ── toast ────────────────────────────────────────────────────────────────── */
  L.toast = function (msg, o) {
    o = o || {};
    var box = $('#toasts');
    if (!box) { box = el('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); D.body.appendChild(box); }
    var kind = o.kind || '', t = el('div', 'toast' + (kind ? ' toast--' + kind : ''), L.icon(kind === 'ok' ? 'success' : kind === 'err' ? 'error' : 'info') + '<span></span>');
    t.lastChild.textContent = msg; box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, o.ms || 4200);
    return t;
  };

  /* ── tabs (roving tabindex, arrow keys) ───────────────────────────────────── */
  L.tabs = function (root) {
    $$('[role="tablist"]', root || D).forEach(function (list) {
      if (list.__t) return; list.__t = 1;
      var tabs = $$('[role="tab"]', list);
      function sel(t, focus) {
        tabs.forEach(function (x) {
          var on = x === t; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
          var p = D.getElementById(x.getAttribute('aria-controls')); if (p) p.hidden = !on;
        });
        if (focus) t.focus();
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { sel(t); });
        t.addEventListener('keydown', function (e) {
          var k = e.key, n = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : null;
          if (n === null) return; e.preventDefault(); sel(tabs[(n + tabs.length) % tabs.length], true);
        });
      });
      sel(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]);
    });
  };

  /* ── delegated interactions ───────────────────────────────────────────────── */
  function delegates() {
    D.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-dialog-open],[data-dialog-close],[data-theme-toggle],[data-nav-toggle],[data-copy],[data-toggle-pw],.shell__scrim,.seg button') : null;
      if (e.target.tagName === 'DIALOG' && e.target.open) { e.target.close(); return; }   // backdrop click (the dialog has no padding, so target === dialog only outside the content)
      if (!t) return;
      if (t.hasAttribute('data-theme-toggle')) L.theme.cycle();
      else if (t.hasAttribute('data-nav-toggle') || t.classList.contains('shell__scrim')) {
        var sh = $('.shell'); if (!sh) return; var open = sh.classList.toggle('is-nav-open');
        $$('[data-nav-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); });
      } else if (t.hasAttribute('data-dialog-open')) { var d = $(t.getAttribute('data-dialog-open')); if (d && d.showModal) d.showModal(); }
      else if (t.hasAttribute('data-dialog-close')) { var dd = t.closest('dialog'); if (dd) dd.close(); }
      else if (t.hasAttribute('data-toggle-pw')) {
        var inp = $(t.getAttribute('data-toggle-pw')); if (!inp) return;
        var show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; t.setAttribute('aria-pressed', show ? 'true' : 'false');
        t.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); t.innerHTML = L.icon(show ? 'eye-off' : 'eye');
      } else if (t.hasAttribute('data-copy')) {
        var src = $(t.getAttribute('data-copy')), txt = src ? (src.getAttribute('data-value') || src.textContent).trim() : '';
        var ok = function () { L.toast('Copied to clipboard', { kind: 'ok' }); }, bad = function () { L.toast('Copy failed. Select the text and copy it manually.', { kind: 'err' }); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, bad); else bad();
      } else if (t.closest('.seg')) {   // segmented control: one pressed at a time, emits ledger:seg
        $$('button', t.parentNode).forEach(function (b) { b.setAttribute('aria-pressed', b === t ? 'true' : 'false'); });
        t.parentNode.dispatchEvent(new CustomEvent('ledger:seg', { bubbles: true, detail: { value: t.getAttribute('data-value') } }));
      }
    });
    D.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var sh = $('.shell.is-nav-open'); if (sh) { sh.classList.remove('is-nav-open'); $$('[data-nav-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
    });
  }

  /* ── init ─────────────────────────────────────────────────────────────────── */
  L.init = function () {
    safe(L.theme.label); safe(L.motion.init); safe(L.roll); safe(L.urlChip); safe(L.tabs); safe(L.tab.refresh); safe(delegates);
    var dm = mq('(prefers-color-scheme: dark)'); if (dm.addEventListener) dm.addEventListener('change', function () { L.tab.refresh(); });
  };
  if (!W.LEDGER_MANUAL) { if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', L.init); else L.init(); }
})();
