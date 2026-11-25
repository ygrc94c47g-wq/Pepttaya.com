// Pepttaya: minimal site JS (mobile menu, reveal-on-scroll)
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('visible'); });
  }


  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

// Re-run safely: dispose the previous instance if the script is loaded again.
(function () {
  if (window.disposeDeliveryCarousel) window.disposeDeliveryCarousel();
  var root = document.querySelector('.delivery-carousel');
  if (!root) return;
  var slides = Array.prototype.slice.call(root.querySelectorAll('.delivery-slide'));
  var prev = root.querySelector('[data-delivery-prev]');
  var next = root.querySelector('[data-delivery-next]');
  var pause = root.querySelector('[data-delivery-pause]');
  var count = root.querySelector('.delivery-count');
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var enabled = !motion.matches, hovered = false, focused = false, index = 0, timer = null;
  var listeners = [];
  function on(el, type, fn) { el.addEventListener(type, fn); listeners.push(function () { el.removeEventListener(type, fn); }); }
  function clear() { if (timer !== null) clearInterval(timer); timer = null; }
  function show(n) {
    index = (n + slides.length) % slides.length;
    slides.forEach(function (slide, i) {
      // Opacity allows outgoing and incoming images to overlap without a blank
      // frame. aria-hidden removes inactive images from the accessibility tree.
      slide.hidden = false;
      slide.classList.toggle('is-active', i === index);
      slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });
    count.textContent = (index + 1) + ' / ' + slides.length;
  }
  function schedule() {
    clear();
    pause.textContent = enabled ? 'Pause' : 'Resume';
    pause.setAttribute('aria-label', enabled ? 'Pause automatic delivery slideshow' : 'Resume automatic delivery slideshow');
    count.setAttribute('aria-live', enabled ? 'off' : 'polite');
    if (enabled && !hovered && !focused && !document.hidden && root.isConnected) {
      timer = setInterval(function () { show(index + 1); }, 2000);
    }
  }
  on(prev, 'click', function () { show(index - 1); schedule(); });
  on(next, 'click', function () { show(index + 1); schedule(); });
  on(pause, 'click', function () { enabled = !enabled; schedule(); });
  on(root, 'mouseenter', function () { hovered = true; schedule(); });
  on(root, 'mouseleave', function () { hovered = false; schedule(); });
  on(root, 'focusin', function () { focused = true; schedule(); });
  on(root, 'focusout', function (e) { if (!root.contains(e.relatedTarget)) { focused = false; schedule(); } });
  on(document, 'visibilitychange', schedule);
  on(window, 'pagehide', clear);
  on(window, 'pageshow', schedule);
  function preference() { enabled = !motion.matches; schedule(); }
  if (motion.addEventListener) on(motion, 'change', preference);
  else if (motion.addListener) { motion.addListener(preference); listeners.push(function () { motion.removeListener(preference); }); }
  // DOM replacement removes the old carousel before the new script executes.
  var observer = new MutationObserver(function () { if (!root.isConnected) dispose(); });
  observer.observe(document.body, { childList: true });
  function dispose() {
    clear(); observer.disconnect(); listeners.forEach(function (off) { off(); }); listeners = [];
    if (window.disposeDeliveryCarousel === dispose) window.disposeDeliveryCarousel = null;
  }
  window.disposeDeliveryCarousel = dispose;
  show(0); schedule();
})();

// Single factory-tour player: muted autoplay in view, optional sound, no forced playback under reduced motion.
(function () {
  if (window.disposeScenePlayer) window.disposeScenePlayer();
  var root = document.querySelector('.scene-player');
  if (!root) return;
  var video = root.querySelector('video');
  var play = root.querySelector('[data-scene-play]');
  var sound = root.querySelector('[data-scene-sound]');
  var status = root.querySelector('.scene-status');
  var motion = matchMedia('(prefers-reduced-motion: reduce)');
  var intent = !motion.matches, inView = false, disposed = false, token = 0, ignoring = false;
  var off = [];
  function on(el, t, f) { el.addEventListener(t, f); off.push(function () { el.removeEventListener(t, f); }); }
  function canPlay() { return intent && inView && !document.hidden && !disposed; }
  function ui() {
    play.textContent = video.paused ? 'Play' : 'Pause';
    play.setAttribute('aria-label', video.paused ? 'Play factory tour' : 'Pause factory tour');
    sound.textContent = video.muted ? 'Sound off' : 'Sound on';
    sound.setAttribute('aria-pressed', video.muted ? 'false' : 'true');
    sound.setAttribute('aria-label', video.muted ? 'Unmute factory tour' : 'Mute factory tour');
  }
  function quiet() { if (!video.paused) { ignoring = true; video.pause(); } }
  function attempt() {
    var generation = ++token;
    if (!canPlay()) { quiet(); ui(); return; }
    var p = video.play();
    if (p && p.catch) p.catch(function () {
      if (generation !== token || disposed) return;
      intent = false; status.textContent = 'Press Play to start the film.'; ui();
    });
    ui();
  }
  on(play, 'click', function () { intent = video.paused; status.textContent = ''; attempt(); });
  on(sound, 'click', function () { video.muted = !video.muted; ui(); });
  on(video, 'click', function () { intent = video.paused; status.textContent = ''; attempt(); });
  on(video, 'pause', function () { if (ignoring) ignoring = false; else intent = false; ui(); });
  on(video, 'play', function () {
    if (!inView || document.hidden) { quiet(); return; }
    intent = true; ui();
  });
  on(video, 'error', function () { intent = false; status.textContent = 'This video could not load.'; ui(); });
  on(document, 'visibilitychange', attempt);
  on(window, 'pagehide', quiet);
  on(window, 'pageshow', attempt);
  function preference() { if (motion.matches) { intent = false; attempt(); } }
  if (motion.addEventListener) on(motion, 'change', preference);
  var io = new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; attempt(); }, { threshold: 0.15 });
  io.observe(root);
  function dispose() {
    disposed = true; ++token; quiet(); io.disconnect(); off.forEach(function (f) { f(); });
    if (window.disposeScenePlayer === dispose) window.disposeScenePlayer = null;
  }
  window.disposeScenePlayer = dispose;
  video.muted = true; video.loop = true; ui(); attempt();
})();
