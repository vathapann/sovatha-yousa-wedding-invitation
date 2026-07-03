/* ══════════════════════════════════════════════════════════════════════
   animate/bird.js  —  bird(s) that flap and glide across the sky
   ──────────────────────────────────────────────────────────────────────
       <script src="animate/bird.js"></script>

   OPTIONS (data-* on the <script> tag):
     data-target="#hero"   mount inside a selector. Omit → whole viewport.
     data-count="1"        how many birds
     data-color="#463b3c"  bird colour
     data-z="3"            z-index of the layer
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
    count:  Math.max(1, parseInt(A('count', '1'), 10) || 1),
    color:  A('color', 'rgba(70,59,60,.75)'),
    zIndex: A('z', '3')
  };

  var NS = 'af-bird';
  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!document.getElementById(NS + '-css')) {
    var css = document.createElement('style');
    css.id = NS + '-css';
    css.textContent = [
      '.' + NS + '-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;}',
      '.' + NS + '{position:absolute;left:-8%;width:46px;',
        'animation:' + NS + '-path 22s linear infinite;}',
      '.' + NS + ' svg{display:block;width:100%;height:auto;transform-origin:center;',
        'animation:' + NS + '-flap .5s ease-in-out infinite;}',
      '@keyframes ' + NS + '-flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.55)}}',
      '@keyframes ' + NS + '-path{',
        '0%{transform:translate(0,0) scale(.7);opacity:0}',
        '8%{opacity:.85}',
        '50%{transform:translate(52vw,-6vh) scale(1);opacity:.85}',
        '92%{opacity:.85}',
        '100%{transform:translate(116vw,4vh) scale(1.15);opacity:0}}',
      '@media (prefers-reduced-motion: reduce){',
        '.' + NS + ',.' + NS + ' svg{animation:none}.' + NS + '{opacity:.6}}'
    ].join('');
    document.head.appendChild(css);
  }

  var SVG = '<svg viewBox="0 0 64 24" fill="none" stroke="currentColor" ' +
            'stroke-width="2.4" stroke-linecap="round">' +
            '<path d="M2 14 C14 2 24 2 32 12 C40 2 50 2 62 14"/></svg>';

  function rand(a, b) { return a + Math.random() * (b - a); }

  function start() {
    var old = document.getElementById(NS + '-layer');
    if (old) old.remove();

    var layer = document.createElement('div');
    layer.className = NS + '-layer';
    layer.id = NS + '-layer';
    layer.style.zIndex = cfg.zIndex;
    layer.setAttribute('aria-hidden', 'true');

    for (var i = 0; i < cfg.count; i++) {
      var b = document.createElement('div');
      b.className = NS;
      b.style.color = cfg.color;
      b.style.top = rand(8, 30).toFixed(1) + '%';
      b.style.width = rand(34, 54).toFixed(0) + 'px';
      var dur = rand(18, 28);
      b.style.animationDuration = dur.toFixed(1) + 's';
      b.style.animationDelay = (reduce ? 0 : -rand(0, dur)).toFixed(1) + 's';
      b.innerHTML = SVG;
      if (reduce) b.querySelector('svg').style.animation = 'none';
      layer.appendChild(b);
    }

    var host = cfg.target ? document.querySelector(cfg.target) : null;
    if (host) {
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(layer);
    } else {
      layer.style.position = 'fixed';
      document.body.appendChild(layer);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})();
