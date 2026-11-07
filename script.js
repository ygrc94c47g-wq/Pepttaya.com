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

// Re-run safely after music.js soft navigation: dispose the previous instance.
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
    slides.forEach(function (slide, i) { slide.hidden = i !== index; });
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
