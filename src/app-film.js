
/* ===================== Films ===================== */
/* A film whose files are missing (the claude.ai copy of the page ships without docs/video/) hides
   itself rather than showing a dead player; the small poster is the probe, since preload="none"
   fetches nothing from the video until play. Starting one film pauses any other. */
(function films() {
  const vids = [...document.querySelectorAll('figure.film video')];
  vids.forEach(v => {
    const fig = v.closest('figure');
    const probe = new Image();
    probe.onerror = () => { fig.hidden = true; };
    probe.src = v.getAttribute('poster');
    v.querySelector('source')?.addEventListener('error', () => { fig.hidden = true; });
    v.addEventListener('play', () => vids.forEach(o => { if (o !== v && !o.paused) o.pause(); }));
  });
})();
