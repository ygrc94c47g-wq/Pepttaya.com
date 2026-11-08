// Pepttaya: background music player
// - small logo + big play/stop button; fixed 25% volume
// - fades in from silence; remembers a user "Stop"
// - starts on the 21+ gate itself: tries autoplay on load, else on the first
//   tap/click/key anywhere (e.g. ticking a gate checkbox); Enter keeps it going
// - returning visitors: same (autoplay on load, else first tap/click/key)
// - keeps playing across pages: internal links (index <-> terms) swap the page
//   content in place so the <audio> element never stops; full page loads resume
//   from the saved position via sessionStorage
(function () {
  var player = document.getElementById('music-player');
  var btn = document.getElementById('music-btn');
  var audio = document.getElementById('music-audio');
  if (!player || !btn || !audio) return;

  // Compact drawer: hover/focus desktop, explicit toggle for touch.
  var tab = player.querySelector('.music-tab');
  var controls = player.querySelector('.music-pill');
  var pinned = false, hovering = false;
  function drawer(open) {
    player.classList.toggle('controls-open', open);
    if (controls) controls.inert = !open;
    if (tab) {
      tab.setAttribute('aria-expanded', String(open));
      tab.setAttribute('aria-label', open ? 'Hide music controls' : 'Show music controls');
    }
  }
  if (tab && controls) {
    tab.addEventListener('click', function () { pinned = !pinned; drawer(pinned); });
    player.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') { hovering = true; drawer(true); } });
    player.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') { hovering = false; if (!pinned && !player.contains(document.activeElement)) drawer(false); } });
    player.addEventListener('focusin', function () { drawer(true); });
    player.addEventListener('focusout', function (e) { if (!player.contains(e.relatedTarget) && !pinned && !hovering) drawer(false); });
    document.addEventListener('pointerdown', function (e) { if (!player.contains(e.target)) { pinned = false; drawer(false); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && player.classList.contains('controls-open')) { pinned = false; tab.focus(); drawer(false); } });
    drawer(false);
  }

  var label = btn.querySelector('.music-label');
  var root = document.documentElement;
  var GATE_KEY = 'pepttaya_gate_v1';
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
  var videoHasSound = false;
  function targetVol() { return videoHasSound ? 0 : DEFAULT_VOL; }
  // The background track yields to any audible video. No second soundtrack;
  // stopping music is still remembered, and muting/pausing video restores it.
  function syncVideoSound() {
    var audible = Array.prototype.some.call(document.querySelectorAll('video'), function (v) {
      return !v.paused && !v.ended && !v.muted && v.volume > 0;
    });
    if (audible !== videoHasSound) {
      videoHasSound = audible;
      if (wantPlaying) fadeTo(targetVol(), 250);
    }
  }
  ['play', 'playing', 'pause', 'ended', 'volumechange', 'emptied'].forEach(function (t) {
    document.addEventListener(t, function (e) { if (e.target.tagName === 'VIDEO') {
      if (t === 'play') document.querySelectorAll('video').forEach(function (v) { if (v !== e.target && !v.paused) v.pause(); });
      syncVideoSound();
    } }, true);
  });
  function gateAccepted() { return !!ls(GATE_KEY); }
  function userStopped() { return ls(STOP_KEY) === '1'; }

  // ---------- Playlist ----------
  // To add songs, append { src, title, artist } entries. One track loops;
  // several tracks play in order and wrap around.
  var TRACKS = [
    { src: audio.getAttribute('src') || 'assets/music.mp3', title: audio.getAttribute('data-title') || '', artist: audio.getAttribute('data-artist') || '' }
  ];
  var trackIdx = 0;

  function loadTrack(i) {
    trackIdx = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    var src = TRACKS[trackIdx].src;
    if (audio.getAttribute('src') !== src) audio.setAttribute('src', src);
    audio.loop = TRACKS.length === 1;
  }
  audio.addEventListener('ended', function () {
    if (TRACKS.length < 2 || !wantPlaying) return;
    loadTrack(trackIdx + 1);
    var p = audio.play(); if (p && p.catch) p.catch(function () {});
    setUI(true); saveState();
  });

  // ---------- Volume: Web Audio gain (works on iOS), fallback audio.volume ----------
  // iOS Safari ignores HTMLMediaElement.volume, so once a user gesture allows
  // it we route <audio> -> MediaElementSource -> GainNode -> speakers.
  var AC = window.AudioContext || window.webkitAudioContext;
  var actx = null, gainNode = null;
  function getLevel() { return gainNode ? gainNode.gain.value : audio.volume; }
  function setLevel(v) {
    v = Math.max(0, Math.min(1, v));
    if (gainNode) { gainNode.gain.value = v; if (audio.volume !== 1) audio.volume = 1; }
    else audio.volume = v;
  }
  function buildIfRunning() {
    if (!actx || gainNode || actx.state !== 'running') return;
    var lvl = audio.volume;
    var src = actx.createMediaElementSource(audio);   // only ever once per element
    gainNode = actx.createGain();
    gainNode.gain.value = lvl;
    src.connect(gainNode); gainNode.connect(actx.destination);
    audio.volume = 1;
    window.__pepttayaGain = gainNode;
  }
  // Called inside user gestures: create the context once, resume it if suspended,
  // and only reroute the audio once it is really running (never silences playback)
  function ensureGraph() {
    if (!AC) return;
    if (!actx) { try { actx = new AC(); } catch (e) { AC = null; return; } }
    if (actx.state === 'running') { buildIfRunning(); return; }
    var p = actx.resume && actx.resume();
    if (p && p.then) p.then(buildIfRunning, function () {}); else buildIfRunning();
  }
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (t) {
    document.addEventListener(t, function (e) {
      if (t === 'pointerdown' && e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      if (gainNode && actx.state === 'running') return;
      ensureGraph();
    }, true);
  });

  function setUI(playing) {
    player.classList.toggle('is-playing', playing);

    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Stop music' : 'Play music');
    if (label) label.textContent = playing ? 'Stop music' : 'Play music';
  }

  function cancelFade() { if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; } }
  // Interval-based so it still runs in background tabs
  function fadeTo(to, ms, done) {
    cancelFade();
    var from = getLevel(), t0 = Date.now();
    if (ms <= 0) { setLevel(to); if (done) done(); return; }
    fadeTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      setLevel(from + (to - from) * k);
      if (k >= 1) { cancelFade(); if (done) done(); }
    }, 40);
  }

  function saveState() {
    ss(STATE_KEY, JSON.stringify({
      playing: wantPlaying && !audio.paused,
      t: audio.currentTime || 0,
      i: trackIdx,
      v: targetVol(),
      ts: Date.now()
    }));
  }

  // fadeMs: 3000 for a fresh start, 300 for a resume
  function start(fadeMs) {
    cancelFade();
    audio.loop = TRACKS.length === 1;
    audio.preload = 'auto';
    setLevel(0);
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
    if (tab && tab.contains(e.target)) return;
    if (btn.contains(e.target)) { disarmGesture(); return; }
    if (userStopped() || wantPlaying) { disarmGesture(); return; }
    // A touch pointerdown is not a user activation yet; wait for touchend/click
    if (e.type === 'pointerdown' && e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
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

  audio.addEventListener('playing', function () { if (wantPlaying) setUI(true); });

  // Gate "Enter" click -> start only if not already playing (never restarts)
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
      syncVideoSound();
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

  // ---------- Keep clear of the terms reading bar ----------
  function placePlayer() {
    var bar = document.getElementById('gate-readbar');
    var off = 0;
    if (root.classList.contains('gate-reading') && bar && !bar.hidden) off = bar.getBoundingClientRect().height;
    player.style.bottom = off ? 'calc(' + Math.ceil(off) + 'px + 10px)' : '';
  }
  if (window.MutationObserver) new MutationObserver(placePlayer).observe(root, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', placePlayer);
  placePlayer();

  // ---------- Initial state on a full page load ----------
  loadTrack(trackIdx);
  setUI(false);
  var saved = null;
  try { saved = JSON.parse(ss(STATE_KEY) || 'null'); } catch (e) {}
  if (!userStopped()) {
    if (saved && typeof saved.i === 'number' && saved.i !== trackIdx) loadTrack(saved.i);
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
