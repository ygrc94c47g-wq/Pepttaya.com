// Pepttaya: background music player
// - small logo + big play/stop button + volume slider
// - fades in from silence; remembers volume and a user "Stop"
// - starts when the visitor clicks Enter on the 21+ gate (a user gesture)
// - returning visitors: tries to start on load, else on the first tap/click/key
// - keeps playing across pages: internal links (index <-> terms) swap the page
//   content in place so the <audio> element never stops; full page loads resume
//   from the saved position via sessionStorage
(function () {
  var player = document.getElementById('music-player');
  var btn = document.getElementById('music-btn');
  var audio = document.getElementById('music-audio');
  var slider = document.getElementById('music-volume');
  if (!player || !btn || !audio) return;

  var label = btn.querySelector('.music-label');
  var root = document.documentElement;
  var GATE_KEY = 'pepttaya_gate_v1';
  var VOL_KEY = 'pepttaya_music_volume';
  var STOP_KEY = 'pepttaya_music_stopped';
  var STATE_KEY = 'pepttaya_music_state';
  var DEFAULT_VOL = 0.25;
  var fadeTimer = null;
  var wantPlaying = false;   // what the visitor intends (button state)
  var gestureArmed = false;
  var armedFade = 3000;

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function ss(k, v) {
    try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; }
  }
  function targetVol() {
    var v = parseFloat(ls(VOL_KEY));
    return isNaN(v) ? DEFAULT_VOL : Math.min(1, Math.max(0, v));
  }
  function gateAccepted() { return !!ls(GATE_KEY); }
  function userStopped() { return ls(STOP_KEY) === '1'; }

  var nowText = document.getElementById('music-now-text');
  var trackName = [audio.getAttribute('data-title'), audio.getAttribute('data-artist')].filter(Boolean).join(' \u2014 ');
  function setUI(playing) {
    player.classList.toggle('is-playing', playing);
    if (nowText) {
      var txt = playing ? (trackName ? 'Now playing \u00b7 ' + trackName : 'Now playing') : '';
      if (nowText.textContent !== txt) nowText.textContent = txt;
    }
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Stop music' : 'Play music');
    if (label) label.textContent = playing ? 'Stop music' : 'Play music';
  }

  function cancelFade() { if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; } }
  // Interval-based so it still runs in background tabs
  function fadeTo(to, ms, done) {
    cancelFade();
    var from = audio.volume, t0 = Date.now();
    if (ms <= 0) { audio.volume = to; if (done) done(); return; }
    fadeTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { cancelFade(); if (done) done(); }
    }, 40);
  }

  function saveState() {
    ss(STATE_KEY, JSON.stringify({
      playing: wantPlaying && !audio.paused,
      t: audio.currentTime || 0,
      v: targetVol(),
      ts: Date.now()
    }));
  }

  // fadeMs: 3000 for a fresh start, 300 for a resume
  function start(fadeMs) {
    cancelFade();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    wantPlaying = true;
    var p;
    try { p = audio.play(); } catch (e) { p = null; }
    setUI(true);
    var ok = function () { fadeTo(targetVol(), fadeMs); disarmGesture(); saveState(); };
    if (p && p.then) {
      return p.then(ok, function () {
        wantPlaying = false; setUI(false); armGesture(fadeMs);
        throw new Error('blocked');
      });
    }
    ok();
    return Promise.resolve();
  }

  function stop() {
    wantPlaying = false;
    setUI(false);
    disarmGesture();
    fadeTo(0, 350, function () {
      if (wantPlaying) return;
      audio.pause();
      try { audio.currentTime = 0; } catch (e) {}
      saveState();
    });
    saveState();
  }

  // Fallback when the browser blocks autoplay: start on the first interaction
  var GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'];
  function onFirstGesture(e) {
    if (btn.contains(e.target)) { disarmGesture(); return; }
    if (slider && slider.contains(e.target)) return;
    if (userStopped() || wantPlaying) { disarmGesture(); return; }
    if (root.classList.contains('gate-open') || root.classList.contains('gate-reading')) return;
    disarmGesture();
    start(armedFade).catch(function () {});
  }
  function armGesture(fadeMs) {
    armedFade = fadeMs || 3000;
    if (gestureArmed) return;
    gestureArmed = true;
    GESTURES.forEach(function (t) { document.addEventListener(t, onFirstGesture, true); });
  }
  function disarmGesture() {
    if (!gestureArmed) return;
    gestureArmed = false;
    GESTURES.forEach(function (t) { document.removeEventListener(t, onFirstGesture, true); });
  }

  btn.addEventListener('click', function () {
    if (wantPlaying) { ls(STOP_KEY, '1'); stop(); }
    else { ls(STOP_KEY, null); start(3000).catch(function () {}); }
  });

  function paintVol(v) { player.style.setProperty('--vol', Math.round(v * 100) + '%'); }
  if (slider) {
    slider.value = String(targetVol());
    var setVol = function () {
      var v = Math.min(1, Math.max(0, parseFloat(slider.value) || 0));
      ls(VOL_KEY, String(v));
      cancelFade();
      if (wantPlaying) audio.volume = v;
      paintVol(v);
      saveState();
    };
    slider.addEventListener('input', setVol);
    slider.addEventListener('change', setVol);
    paintVol(targetVol());
  }

  audio.addEventListener('playing', function () { if (wantPlaying) setUI(true); });

  // Gate "Enter" click -> start with fade-in (inside the user gesture)
  document.addEventListener('pepttaya:entered', function () {
    if (!userStopped() && !wantPlaying) start(3000).catch(function () {});
  });

  // Save position often so a full page load can resume where it left off
  setInterval(function () { if (wantPlaying && !audio.paused) saveState(); }, 1000);
  window.addEventListener('pagehide', saveState);
  window.addEventListener('beforeunload', saveState);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveState(); });

  // ---------- Soft navigation between internal pages (keeps audio alive) ----------
  function norm(p) { return p.replace(/index\.html$/, '').replace(/\.html$/, ''); }
  function internalPage(a) {
    if (!a || !a.href || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
    var u;
    try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin) return null;
    if (!/^\/(index\.html|terms(\.html)?)?$/.test(u.pathname)) return null;
    if (norm(u.pathname) === norm(location.pathname) && u.search === location.search) return null; // same page
    return u;
  }
  function softNavOK() {
    return gateAccepted() && !root.classList.contains('gate-open') && !root.classList.contains('gate-reading') &&
      !!(window.fetch && window.DOMParser && window.history && history.pushState);
  }
  function rerun(src) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = s.onerror = function () { if (s.parentNode) s.parentNode.removeChild(s); };
    document.body.appendChild(s);
  }
  function swapTo(url, push) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc.body || !doc.getElementById('music-player')) throw new Error('not a site page');
      Array.prototype.slice.call(document.body.children).forEach(function (el) {
        if (el !== player && el.tagName !== 'SCRIPT') el.parentNode.removeChild(el);
      });
      Array.prototype.slice.call(doc.body.children).forEach(function (el) {
        if (el.id === 'music-player' || el.tagName === 'SCRIPT') return;
        document.body.insertBefore(document.importNode(el, true), player);
      });
      document.body.className = doc.body.className;
      document.title = doc.title;
      var canon = document.querySelector('link[rel=canonical]'), nc = doc.querySelector('link[rel=canonical]');
      if (canon && nc) canon.setAttribute('href', nc.getAttribute('href'));
      if (push) history.pushState({ softnav: true }, '', url);
      rerun('script.js');   // menu, reveal-on-scroll, year
      rerun('gate.js');     // gate state for the new page (already accepted)
      var hash = new URL(url, location.href).hash;
      var target = hash && document.getElementById(hash.slice(1));
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
    });
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    var u = internalPage(a);
    if (!u || !softNavOK()) return;
    e.preventDefault();
    saveState();
    swapTo(u.href, true).catch(function () { location.href = u.href; });
  });
  try { history.replaceState({ softnav: true }, ''); } catch (e) {}
  window.addEventListener('popstate', function (e) {
    if (!e.state || !e.state.softnav) return;
    swapTo(location.href, false).catch(function () { location.reload(); });
  });

  // ---------- Initial state on a full page load ----------
  setUI(false);
  var saved = null;
  try { saved = JSON.parse(ss(STATE_KEY) || 'null'); } catch (e) {}
  if (gateAccepted() && !userStopped()) {
    if (saved && saved.playing && typeof saved.t === 'number') {
      // Resume from the same point (plus the moment spent loading)
      var t = saved.t + Math.min(3, Math.max(0, (Date.now() - (saved.ts || Date.now())) / 1000));
      audio.preload = 'auto';
      try { audio.currentTime = t; } catch (e) {}
      audio.addEventListener('loadedmetadata', function () {
        if (Math.abs(audio.currentTime - t) > 0.5) {
          try { audio.currentTime = audio.duration ? t % audio.duration : t; } catch (e) {}
        }
      }, { once: true });
      start(300).catch(function () {});
    } else {
      start(3000).catch(function () {});
    }
  }
})();
