/* ══════════════════════════════════════════════════════════════════════
   animate/mist-rays.js  —  drifting mist / clouds + soft god-rays of light
   ──────────────────────────────────────────────────────────────────────
       <script src="animate/mist-rays.js"></script>

   OPTIONS (data-* on the <script> tag):
     data-target="#hero"   mount inside a selector. Omit → whole viewport.
     data-intensity="1"    0.3 = subtle … 1.5 = heavy
     data-rays="1"         "1" show light beams, "0" mist only
     data-z="1"            z-index of the layer (kept low; it's atmosphere)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var script = document.currentScript;
  var A = function (n, d) {
    var v = script && script.getAttribute('data-' + n);
    return (v === null || v === undefined || v === '') ? d : v;
  };

  var cfg = {
    target:    A('target', ''),
    intensity: Math.max(0, parseFloat(A('intensity', '1')) || 1),
    rays:      A('rays', '1') !== '0',
    zIndex:    A('z', '1')
  };

  var NS = 'af-mist';

  if (!document.getElementById(NS + '-css')) {
    var css = document.createElement('style');
    css.id = NS + '-css';
    css.textContent = [
      '.' + NS + '-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;}',
      '.' + NS + '-cloud{position:absolute;left:-30%;width:160%;height:46%;top:6%;',
        'mix-blend-mode:screen;filter:blur(6px);',
        'background:',
          'radial-gradient(60% 70% at 20% 50%, rgba(255,255,255,.9), transparent 60%),',
          'radial-gradient(50% 60% at 55% 40%, rgba(255,255,255,.7), transparent 60%),',
          'radial-gradient(55% 65% at 85% 55%, rgba(255,255,255,.8), transparent 60%);',
        'animation:' + NS + '-drift 40s linear infinite;}',
      '.' + NS + '-cloud.b{top:2%;height:36%;animation-duration:64s;animation-direction:reverse;}',
      '.' + NS + '-rays{position:absolute;top:-20%;left:20%;width:60%;height:120%;',
        'mix-blend-mode:screen;filter:blur(4px);transform-origin:top center;',
        'background:repeating-linear-gradient(105deg,',
          'rgba(255,246,224,0) 0px, rgba(255,246,224,.35) 18px, rgba(255,246,224,0) 60px);',
        'animation:' + NS + '-ray 12s ease-in-out infinite alternate;}',
      '@keyframes ' + NS + '-drift{from{transform:translateX(-8%)}to{transform:translateX(8%)}}',
      '@keyframes ' + NS + '-ray{',
        'from{opacity:.28;transform:translateX(-3%) skewX(-2deg)}',
        'to{opacity:.6;transform:translateX(3%) skewX(2deg)}}',
      '@media (prefers-reduced-motion: reduce){',
        '.' + NS + '-cloud,.' + NS + '-rays{animation:none}}'
    ].join('');
    document.head.appendChild(css);
  }

  function start() {
    var old = document.getElementById(NS + '-layer');
    if (old) old.remove();

    var layer = document.createElement('div');
    layer.className = NS + '-layer';
    layer.id = NS + '-layer';
    layer.style.zIndex = cfg.zIndex;
    layer.style.opacity = Math.min(1, 0.55 * cfg.intensity);
    layer.setAttribute('aria-hidden', 'true');

    var c1 = document.createElement('div'); c1.className = NS + '-cloud';
    var c2 = document.createElement('div'); c2.className = NS + '-cloud b';
    layer.appendChild(c1); layer.appendChild(c2);
    if (cfg.rays) {
      var r = document.createElement('div'); r.className = NS + '-rays';
      layer.appendChild(r);
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
