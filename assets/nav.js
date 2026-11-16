/* Header: phone menu, and a brass marker on the section you're reading. */
(function () {
  var body = document.body, btn = document.getElementById('burger');
  if (btn) {
    var set = function (open) {
      body.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    btn.addEventListener('click', function () { set(!body.classList.contains('menu-open')); });
    document.querySelectorAll('#menu a').forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
    window.matchMedia('(min-width: 821px)').addEventListener('change', function (m) { if (m.matches) set(false); });
  }
  if (!('IntersectionObserver' in window)) return;
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href*="#"]'));
  var byId = {};
  links.forEach(function (a) { var id = a.getAttribute('href').split('#')[1]; var el = document.getElementById(id); if (el) byId[id] = a; });
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { links.forEach(function (l) { l.classList.remove('active'); }); if (byId[e.target.id]) byId[e.target.id].classList.add('active'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(byId).forEach(function (id) { obs.observe(document.getElementById(id)); });
})();
