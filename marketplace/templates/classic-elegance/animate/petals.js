/* ══════════════════════════════════════════════════════════════════════
   animate/petals.js  —  self-contained "falling petals" animation
   ──────────────────────────────────────────────────────────────────────
       <script src="animate/petals.js"></script>

   OPTIONS (data-* on the <script> tag):
     data-target="#hero"   mount inside a selector. Omit → whole viewport.
     data-count="26"       petals alive at once
     data-color="#e9a6b8"  petal colour (a few paler ones are mixed in)
     data-wind="0"         horizontal bias in px (+ blows right, - left)
     data-z="2"            z-index of the layer
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var script = document.currentScript;
  var A = function (n, d) {
    var v = script && script.getAttribute('data-' + n);
    return (v === null || v === undefined || v === '') ? d : v;
  };

  var cfg = {
    target: A('target', ''),
    count:  Math.max(1, parseInt(A('count', '26'), 10) || 26),
    color:  A('color', '#e9a6b8'),
    wind:   parseFloat(A('wind', '0')) || 0,
    zIndex: A('z', '2')
  };

  var NS = 'af-petal';
  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!document.getElementById(NS + '-css')) {
    var css = document.createElement('style');
    css.id = NS + '-css';
    css.textContent = [
      '.' + NS + '-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;}',
      '.' + NS + '{position:absolute;top:-8%;',
        'background:radial-gradient(circle at 30% 30%, #fff0f4, var(--afpc,#e9a6b8));',
        'border-radius:14px 1px 14px 1px;will-change:transform;',
        'animation:' + NS + '-fall linear infinite;}',
      '@keyframes ' + NS + '-fall{',
        '0%{transform:translate(0,-10vh) rotate(0deg)}',
        '100%{transform:translate(var(--afpd,40px),112vh) rotate(560deg)}}',
      '@media (prefers-reduced-motion: reduce){.' + NS + '{animation:none;display:none}}'
    ].join('');
    document.head.appendChild(css);
  }

  function mount() {
    var old = document.getElementById(NS + '-layer');
    if (old) old.remove();
    var layer = document.createElement('div');
    layer.className = NS + '-layer';
    layer.id = NS + '-layer';
    layer.style.zIndex = cfg.zIndex;
    layer.setAttribute('aria-hidden', 'true');
    var host = cfg.target ? document.querySelector(cfg.target) : null;
    if (host) {
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(layer);
    } else {
      layer.style.position = 'fixed';
      document.body.appendChild(layer);
    }
    return layer;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn(layer) {
    var p = document.createElement('span');
    p.className = NS;
    var size = rand(8, 18);
    p.style.width = p.style.height = size.toFixed(1) + 'px';
    p.style.left = rand(0, 100).toFixed(1) + '%';
    p.style.opacity = rand(0.5, 1).toFixed(2);
    p.style.setProperty('--afpc', Math.random() < 0.3 ? '#f7d9e2' : cfg.color);
    p.style.setProperty('--afpd', (rand(-90, 90) + cfg.wind).toFixed(0) + 'px');
    var dur = rand(7, 15);
    p.style.animationDuration = dur.toFixed(2) + 's';
    p.style.animationDelay = (-rand(0, dur)).toFixed(2) + 's';
    layer.appendChild(p);
    if (!reduce) {
      window.setTimeout(function () { p.remove(); spawn(layer); }, dur * 1000);
    }
  }

  function start() {
    var layer = mount();
    for (var i = 0; i < cfg.count; i++) spawn(layer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})();
