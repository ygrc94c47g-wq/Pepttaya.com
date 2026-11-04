// Pepttaya: background music with a play/stop button (never autoplays)
(function () {
  var btn = document.getElementById('music-btn');
  var audio = document.getElementById('music-audio');
  var player = document.getElementById('music-player');
  if (!btn || !audio || !player) return;
  var label = btn.querySelector('.music-label');

  function setState(playing) {
    player.classList.toggle('is-playing', playing);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Stop music' : 'Play music');
    if (label) label.textContent = playing ? 'Stop music' : 'Play music';
  }
  function stop() {
    audio.pause();
    try { audio.currentTime = 0; } catch (e) {}
    setState(false);
  }
  function play() {
    audio.loop = true;
    var p = audio.play();
    setState(true);
    if (p && p.catch) p.catch(function () { setState(false); });
  }

  btn.addEventListener('click', function () {
    if (audio.paused) play(); else stop();
  });
  audio.addEventListener('pause', function () { if (!audio.ended) setState(false); });
  audio.addEventListener('playing', function () { setState(true); });
  setState(false);
})();
