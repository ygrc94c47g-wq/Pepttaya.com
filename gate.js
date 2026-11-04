// Pepttaya: 21+ entry gate with Terms of Service acceptance
(function () {
  var KEY = 'pepttaya_gate_v1';
  var root = document.documentElement;
  var gate = document.getElementById('age-gate');
  if (!gate) return;

  var age = document.getElementById('gate-age');
  var tos = document.getElementById('gate-tos');
  var enter = document.getElementById('gate-enter');
  var tosLink = document.getElementById('gate-tos-link');
  var readbar = document.getElementById('gate-readbar');
  var reopen = document.getElementById('gate-reopen');
  var isTerms = document.body.classList.contains('terms-page');
  var lastFocus = null;

  function accepted() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ accepted: true, ts: new Date().toISOString() })); } catch (e) {}
  }
  function siblings() {
    return Array.prototype.filter.call(document.body.children, function (el) {
      return el !== gate && el !== readbar && el.id !== 'music-player' && el.tagName !== 'SCRIPT';
    });
  }
  function setInert(on) {
    siblings().forEach(function (el) {
      if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
  }
  function update() {
    var ok = age.checked && tos.checked;
    enter.disabled = !ok;
    enter.setAttribute('aria-disabled', ok ? 'false' : 'true');
  }
  function focusables() {
    var sel = 'a[href], button, input, [tabindex]:not([tabindex="-1"])';
    var mp = document.getElementById('music-player');
    var els = Array.prototype.slice.call(gate.querySelectorAll(sel));
    if (mp) els = els.concat(Array.prototype.slice.call(mp.querySelectorAll(sel)));
    return Array.prototype.filter.call(
      els,
      function (el) { return !el.disabled && el.offsetParent !== null; }
    );
  }
  function open() {
    root.classList.remove('gate-reading');
    root.classList.add('gate-open');
    setInert(true);
    gate.removeAttribute('hidden');
    setTimeout(function () { (age || gate).focus(); }, 30);
  }
  function close() {
    root.classList.remove('gate-open');
    setInert(false);
  }
  function enterReading() {
    lastFocus = document.activeElement;
    close();
    root.classList.add('gate-reading');
    if (readbar) readbar.removeAttribute('hidden');
    window.scrollTo(0, 0);
  }

  age.addEventListener('change', update);
  tos.addEventListener('change', update);
  update();

  enter.addEventListener('click', function () {
    if (!(age.checked && tos.checked)) return;
    save();
    close();
    // Let the music player start inside this click (counts as a user gesture)
    try { document.dispatchEvent(new CustomEvent('pepttaya:entered')); } catch (e) {}
    root.classList.remove('gate-reading');
    if (readbar) readbar.setAttribute('hidden', '');
  });

  // On the terms page, "Terms of Service" lets people read the page (not persisted)
  if (isTerms && tosLink) {
    tosLink.addEventListener('click', function (e) { e.preventDefault(); enterReading(); });
  }
  if (reopen) reopen.addEventListener('click', open);

  // While reading the terms, links that leave the page reopen the gate instead
  document.addEventListener('click', function (e) {
    if (!root.classList.contains('gate-reading')) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || gate.contains(a) || (readbar && readbar.contains(a))) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') return;
    e.preventDefault();
    open();
  }, true);

  // Keep keyboard focus inside the dialog (and the music controls)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !root.classList.contains('gate-open') || !document.body.contains(gate)) return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Soft glow that follows the mouse (mouse only, not with reduced motion)
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    gate.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      gate.style.setProperty('--gx', e.clientX + 'px');
      gate.style.setProperty('--gy', e.clientY + 'px');
    });
  }

  if (accepted()) { close(); gate.setAttribute('hidden', ''); }
  else { open(); }
})();
