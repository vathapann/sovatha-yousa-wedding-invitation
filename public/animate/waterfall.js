/* ══════════════════════════════════════════════════════════════════════
   animate/waterfall.js  —  cascade shimmer + rising mist at its base
   ──────────────────────────────────────────────────────────────────────
       <script src="animate/waterfall.js"></script>

   Positioned as a % box over wherever the waterfall sits in your image.
   Defaults line up with a centered cascade — nudge to match your picture.

   OPTIONS (data-* on the <script> tag):
     data-target="#hero"   mount inside a selector. Omit → whole viewport.
     data-left="42"  data-top="38"  data-width="16"  data-height="34"
                           the shimmer box, in % of the layer
     data-z="1"            z-index of the layer
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
    left:   A('left', '42'),
    top:    A('top', '38'),
    width:  A('width', '16'),
    height: A('height', '34'),
    zIndex: A('z', '1')
  };

  var NS = 'af-fall';

  if (!document.getElementById(NS + '-css')) {
    var css = document.createElement('style');
    css.id = NS + '-css';
    css.textContent = [
      '.' + NS + '-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;}',
      '.' + NS + '-flow{position:absolute;opacity:.6;mix-blend-mode:screen;',
        'border-radius:40%;filter:blur(1.5px);',
        'background:repeating-linear-gradient(to bottom,',
          'rgba(255,255,255,0) 0px, rgba(255,255,255,.55) 4px, rgba(255,255,255,0) 12px);',
        'animation:' + NS + '-flow 1.1s linear infinite;}',
      '.' + NS + '-base{position:absolute;mix-blend-mode:screen;filter:blur(8px);',
        'background:radial-gradient(60% 80% at 50% 100%, rgba(255,255,255,.9), transparent 70%);',
        'animation:' + NS + '-rise 5.5s ease-in-out infinite;}',
      '@keyframes ' + NS + '-flow{from{background-position-y:0}to{background-position-y:16px}}',
      '@keyframes ' + NS + '-rise{',
        '0%,100%{opacity:.15;transform:translateY(6px) scale(1)}',
        '50%{opacity:.5;transform:translateY(-8px) scale(1.1)}}',
      '@media (prefers-reduced-motion: reduce){',
        '.' + NS + '-flow,.' + NS + '-base{animation:none}}'
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
    layer.setAttribute('aria-hidden', 'true');

    var flow = document.createElement('div');
    flow.className = NS + '-flow';
    flow.style.left = cfg.left + '%';
    flow.style.top = cfg.top + '%';
    flow.style.width = cfg.width + '%';
    flow.style.height = cfg.height + '%';

    var base = document.createElement('div');
    base.className = NS + '-base';
    var w = parseFloat(cfg.width);
    base.style.left = (parseFloat(cfg.left) - w * 0.25) + '%';
    base.style.top = (parseFloat(cfg.top) + parseFloat(cfg.height) - 4) + '%';
    base.style.width = (w * 1.5) + '%';
    base.style.height = '16%';

    layer.appendChild(flow);
    layer.appendChild(base);

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
