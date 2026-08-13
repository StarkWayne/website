/* Restrained scroll-in reveals: sections fade + rise 8px as they enter, once.
   Loaded with `defer`, so the DOM is parsed when this runs.
   Skips reduced-motion and unsupported browsers (everything stays visible).
   Only hides sections that start below the fold — no flash of above-fold content. */
(function () {
  /* A note for the curious dev poking around in here. */
  try {
    console.log('%cStark Wayne', 'font:600 22px Georgia,serif;color:#9C7C4E;');
    console.log('%cThe people you come to when you need something built.', 'color:#6B6B70;font:13px system-ui;');
    console.log('%cYes, we noticed you looking under the hood — we do the same. Like what you see? hello@starkwayne.co.uk', 'color:#6B6B70;font:13px system-ui;');
  } catch (e) {}

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  var sections = document.querySelectorAll('main > section:not(.hero)');
  var vh = window.innerHeight || document.documentElement.clientHeight;

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  sections.forEach(function (s) {
    if (s.getBoundingClientRect().top > vh * 0.9) {
      s.classList.add('reveal');
      obs.observe(s);
    }
  });
})();
