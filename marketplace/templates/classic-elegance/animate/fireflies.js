/* ══════════════════════════════════════════════════════════════════════
   animate/fireflies.js  —  self-contained "fireflies / bokeh" animation
   ──────────────────────────────────────────────────────────────────────
   Drop-in module. index.html includes ONE animation file per test:

       <script src="animate/fireflies.js"></script>

   It injects its own CSS + elements — no other files needed. Nothing else
   in the page has to change.

   OPTIONS (set as data-* attributes on the <script> tag):
     data-target="#hero"   CSS selector to mount inside. Omit → floats over
                           the whole viewport (fixed overlay on <body>).
     data-count="22"       how many fireflies are alive at once
     data-color="#fff6d8"  glow colour
     data-area="lower"     "lower" (rise from the flowers) | "full"
     data-z="2"            z-index of the layer

   Examples:
     <script src="animate/fireflies.js" data-target=".hero" data-count="30"></script>
     <script src="animate/fireflies.js" data-color="#ffe9a8" data-area="full"></script>
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var script = document.currentScript;
  var A = function (name, dflt) {
    var v = script && script.getAttribute('data-' + name);
    return (v === null || v === undefined || v === '') ? dflt : v;
  };

  var cfg = {
    target: A('target', ''),
    count:  Math.max(1, parseInt(A('count', '22'), 10) || 22),
    color:  A('color', '#fff6d8'),
    area:   A('area', 'lower'),          // 'lower' | 'full'
    zIndex: A('z', '2')
  };

  var NS = 'af-firefly';                 // namespace so we never clash
  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- inject stylesheet once ---------- */
  if (!document.getElementById(NS + '-css')) {
    var css = document.createElement('style');
    css.id = NS + '-css';
    css.textContent = [
      '.' + NS + '-layer{position:absolute;inset:0;overflow:hidden;',
        'pointer-events:none;}',
      '.' + NS + '{position:absolute;border-radius:50%;',
        'background:radial-gradient(circle, var(--afc,#fff6d8),',
        'rgba(255,235,180,.25) 55%, transparent 70%);',
        'box-shadow:0 0 8px 2px rgba(255,235,180,.6);',
        'will-change:transform,opacity;',
        'animation:' + NS + '-twinkle ease-in-out infinite,',
                    NS + '-float linear infinite;}',
      '@keyframes ' + NS + '-twinkle{0%,100%{opacity:.12}50%{opacity:1}}',
      '@keyframes ' + NS + '-float{',
        '0%{transform:translate(0,0)}',
        '100%{transform:translate(var(--afsx,14px),var(--afsy,-26vh))}}',
      '@media (prefers-reduced-motion: reduce){',
        '.' + NS + '{animation:none;opacity:.5}}'
    ].join('');
    document.head.appendChild(css);
  }

  /* ---------- build (or reuse) the layer ---------- */
  function mount() {
    // remove a previous instance so re-includes / hot-swaps stay clean
    var old = document.getElementById(NS + '-layer');
    if (old) old.remove();

    var layer = document.createElement('div');
    layer.className = NS + '-layer';
    layer.id = NS + '-layer';
    layer.style.zIndex = cfg.zIndex;
    layer.setAttribute('aria-hidden', 'true');

    var host = cfg.target ? document.querySelector(cfg.target) : null;
    if (host) {
      // scope to an element — make sure it can contain an absolute child
      var pos = getComputedStyle(host).position;
      if (pos === 'static') host.style.position = 'relative';
      host.appendChild(layer);
    } else {
      // float over the whole viewport
      layer.style.position = 'fixed';
      document.body.appendChild(layer);
    }
    return layer;
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  function spawn(layer) {
    var f = document.createElement('span');
    f.className = NS;
    var size = rand(3, 8);
    f.style.setProperty('--afc', cfg.color);
    f.style.width = f.style.height = size.toFixed(1) + 'px';
    f.style.left = rand(0, 100).toFixed(1) + '%';
    f.style.top  = (cfg.area === 'full' ? rand(0, 100) : rand(55, 100)).toFixed(1) + '%';
    f.style.setProperty('--afsx', rand(-24, 24).toFixed(0) + 'px');
    f.style.setProperty('--afsy', rand(-18, -34).toFixed(0) + 'vh');

    var twinkle = rand(1.4, 3.6);
    var drift   = rand(6, 13);
    f.style.animationDuration = twinkle.toFixed(2) + 's, ' + drift.toFixed(2) + 's';
    f.style.animationDelay = '0s, ' + (-rand(0, drift)).toFixed(2) + 's';

    layer.appendChild(f);
    if (!reduce) {
      window.setTimeout(function () {
        f.remove();
        spawn(layer);           // keep the population steady
      }, drift * 1000);
    }
  }

  function start() {
    var layer = mount();
    for (var i = 0; i < cfg.count; i++) spawn(layer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
