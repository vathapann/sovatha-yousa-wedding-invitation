/* Shared site header for portal pages (my.html, edit.html).
   Injects the same topbar as the storefront — brand, pill nav, actions,
   mobile hamburger — so the menu is maintained in one place.
   Usage: <script defer src="/site-header.js"></script> */
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // The topbar styles live in the storefront stylesheet; load it (and the
  // brand's heavy-italic Jost) if this page doesn't already include them.
  function ensureCss(href, marker) {
    if (document.querySelector('link[href*="' + marker + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.insertBefore(link, document.head.querySelector('style'));
  }
  ensureCss('/styles.css', '/styles.css');
  ensureCss('https://fonts.googleapis.com/css2?family=Jost:ital,wght@1,700;1,800&display=swap', 'ital,wght@1,700');

  ready(function () {
    var header =
      '<nav class="topbar">' +
      '<a class="brand" href="/"><img class="brand-logo" src="/assets/logo.svg" alt="Mongkol"></a>' +
      '<div class="topbar-links">' +
      '<a href="/#templates" class="nav-link">Templates</a>' +
      '<a href="/#features" class="nav-link">Features</a>' +
      '<a href="/#reviews" class="nav-link">Reviews</a>' +
      '<a href="/#offer" class="nav-link">What We Offer</a>' +
      '</div>' +
      '<div class="topbar-actions">' +
      '<a class="my-btn" href="/my.html">My Invitation</a>' +
      '</div>' +
      '<button id="menuBtn" class="menu-btn" aria-label="Menu" aria-expanded="false">' +
      '<span></span><span></span><span></span>' +
      '</button>' +
      '</nav>';
    document.body.insertAdjacentHTML('afterbegin', header);

    var topbar = document.querySelector('.topbar');
    var menuBtn = document.getElementById('menuBtn');
    menuBtn.addEventListener('click', function () {
      var open = topbar.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
  });
})();
