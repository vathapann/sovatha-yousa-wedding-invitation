/* Shared progress stepper for the purchase flow.
   Renders  Information ─ Payment ─ Details  with the current step active
   and earlier steps checked off, like a checkout progress bar.

   Usage — add ONE line to the page's <head>:
     <script defer src="/steps.js" data-step="1"></script>   (checkout)
     <script defer src="/steps.js" data-step="2"></script>   (payment)
     <script defer src="/steps.js" data-step="3"></script>   (details)

   It mounts itself at the top of the page's .wrap container.
   Change STEPS below to rename the stages. */
(function () {
  var STEPS = ['Information', 'Payment', 'Details'];

  var script = document.currentScript;
  var current = parseInt((script && script.getAttribute('data-step')) || '1', 10) || 1;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  if (!document.getElementById('stepper-css')) {
    var css = document.createElement('style');
    css.id = 'stepper-css';
    css.textContent = [
      '.stepper{display:flex;align-items:center;gap:8px;margin:0 0 28px;',
        "font-family:'Jost',sans-serif;font-size:13px;}",
      '.stepper .step{display:flex;align-items:center;gap:8px;}',
      '.stepper .dot{width:26px;height:26px;border-radius:50%;flex:0 0 auto;',
        'display:grid;place-items:center;font-size:12px;font-weight:500;line-height:1;',
        'background:#fff;border:1px solid var(--line,#d6e3ec);color:var(--sub,#728a97);',
        'transition:all .2s ease;}',
      '.stepper .lbl{white-space:nowrap;color:var(--sub,#728a97);}',
      '.stepper .bar{flex:1 1 auto;min-width:12px;height:1px;background:var(--line,#d6e3ec);}',
      /* completed */
      '.stepper .step.done .dot{background:var(--tint,#e6eff5);border-color:transparent;',
        'color:var(--deep,#7fa8c2);}',
      '.stepper .step.done .lbl{color:var(--ink,#37505e);}',
      '.stepper .bar.done{background:var(--deep,#7fa8c2);}',
      /* current */
      '.stepper .step.active .dot{background:var(--ink,#37505e);border-color:transparent;color:#fff;}',
      '.stepper .step.active .lbl{color:var(--ink,#37505e);font-weight:500;}',
      /* tight screens: keep only the current label to avoid crowding */
      '@media (max-width:400px){.stepper .step:not(.active) .lbl{display:none;}}'
    ].join('');
    document.head.appendChild(css);
  }

  ready(function () {
    var html = '<div class="stepper" role="list" aria-label="Progress">';
    for (var i = 0; i < STEPS.length; i++) {
      var n = i + 1;
      var state = n < current ? 'done' : (n === current ? 'active' : '');
      var mark = n < current ? '✓' : String(n);      // ✓ for finished steps
      var aria = state === 'active' ? ' aria-current="step"' : '';
      if (i > 0) html += '<span class="bar' + (n <= current ? ' done' : '') + '"></span>';
      html += '<div class="step ' + state + '" role="listitem"' + aria + '>' +
                '<span class="dot">' + mark + '</span>' +
                '<span class="lbl">' + STEPS[i] + '</span>' +
              '</div>';
    }
    html += '</div>';

    var host = document.querySelector('.wrap') || document.body;
    host.insertAdjacentHTML('afterbegin', html);
  });
})();
