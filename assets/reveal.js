/* Restrained scroll-in reveals: sections fade + rise 8px as they enter, once.
   Loaded with `defer`, so the DOM is parsed when this runs.
   Skips reduced-motion and unsupported browsers (everything stays visible).
   Only hides sections that start below the fold — no flash of above-fold content. */
(function () {
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
