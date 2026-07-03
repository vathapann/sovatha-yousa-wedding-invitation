/* ══════════════════════════════════════════════════════════════════════
   animate/full-scene.js  —  everything at once (the "living picture")
   ──────────────────────────────────────────────────────────────────────
       <script src="animate/full-scene.js"></script>

   Loads the sibling modules together: mist-rays + waterfall + petals
   + fireflies + bird. It just pulls them from the same folder, so each
   still injects its own CSS/DOM and stays independent.

   OPTIONS (data-* on the <script> tag):
     data-target="#hero"   pass a mount selector through to every module.
                           Omit → each floats over the whole viewport.
   Fine-tune any single effect by including that module's own <script>
   with its data-* options instead of (or in addition to) this one.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var script = document.currentScript;
  var target = (script && script.getAttribute('data-target')) || '';

  // resolve this file's folder so we can find the siblings
  var base = (script && script.src) ? script.src.replace(/[^/]*$/, '') : 'animate/';

  // order matters only for z-index layering defaults inside each module
  var modules = ['mist-rays.js', 'waterfall.js', 'petals.js', 'fireflies.js', 'bird.js'];

  modules.forEach(function (file) {
    var s = document.createElement('script');
    s.src = base + file;
    if (target) s.setAttribute('data-target', target);
    document.head.appendChild(s);
  });
})();
