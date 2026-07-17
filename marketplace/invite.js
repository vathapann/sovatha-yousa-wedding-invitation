/* ═══════════════════════════════════════════════════════════════
   invite.js — shared hydrator for published invitations.

   The Worker injects window.INVITE (the couple's config) into a
   template served at /i/<slug>/ and loads this script after it.
   It personalizes the template's text, adds the guest greeting
   (?g= links), and injects the RSVP + wishes, KHQR gift, calendar
   and share features that previews don't have.

   Does nothing when window.INVITE is absent (plain previews).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var INV = window.INVITE;
  if (!INV) return;

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function setText(sel, value) {
    if (!value) return;
    $$(sel).forEach(function (el) { el.textContent = value; });
  }

  // classic-elegance runs its own bilingual data-en/data-km system and
  // has native RSVP/wishes forms — its script.js reads window.INVITE
  // directly, so here we only handle the injected extras.
  var isClassic = !!document.getElementById('langToggle');

  var A = INV.coupleA || '';
  var B = INV.coupleB || '';
  var both = A && B ? A + ' & ' + B : '';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ── Couple's design choices (background, fonts, text size) ──
       Overrides the template's neutral vars only — accent colors
       (--primary, --deep, --accent, --gold…) are left untouched.
       NOTE: must be assigned before ready() runs — ready() executes
       synchronously in deferred scripts and reads FONT_PAIRS. ── */
  var FONT_PAIRS = {
    classic: null, // template default
    romantic: {
      css: 'Great+Vibes&family=Cormorant+Garamond:wght@400;500',
      heading: '"Great Vibes", cursive',
      body: '"Cormorant Garamond", serif',
    },
    modern: {
      css: 'Playfair+Display:wght@500;600&family=Montserrat:wght@300;400;500',
      heading: '"Playfair Display", serif',
      body: '"Montserrat", sans-serif',
    },
    royal: {
      css: 'Cinzel:wght@400;500&family=EB+Garamond:wght@400;500',
      heading: '"Cinzel", serif',
      body: '"EB Garamond", serif',
    },
    minimal: {
      css: 'Montserrat:wght@300;400;500;600',
      heading: '"Montserrat", sans-serif',
      body: '"Montserrat", sans-serif',
    },
  };

  function hexShade(hex, amount) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function adj(v) { return Math.max(0, Math.min(255, Math.round(v + amount * 255))); }
    return '#' + ((adj(r) << 16) | (adj(g) << 8) | adj(b)).toString(16).padStart(6, '0');
  }

  function applyCustomStyle(style) {
    if (!style) return;
    var css = '';

    if (/^#[0-9a-f]{6}$/i.test(style.bg || '')) {
      var section = hexShade(style.bg, -0.045);
      css += ':root{--page:' + style.bg + ';--section:' + section + ';}' +
        '.invite{background:' + style.bg + ';}';
    }

    var pair = FONT_PAIRS[style.fontPair];
    if (pair) {
      var id = 'ivFontPair';
      var link = document.getElementById(id);
      var href = 'https://fonts.googleapis.com/css2?family=' + pair.css + '&display=swap';
      if (!link) {
        link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      if (link.href !== href) link.href = href;
      css += 'body,.invite,p,input,textarea,button{font-family:' + pair.body + ',sans-serif;}' +
        'h1,h2,h3,.n,.names,.amp,.script,.quote,.big,.num,.time,.t,.iv-h2,.hero-date,.when' +
        '{font-family:' + pair.heading + ' !important;}';
    }

    var fs = parseFloat(style.fontScale);
    if (fs && fs >= 0.85 && fs <= 1.25 && fs !== 1) {
      css += ':root{--ivfs:' + fs + ';}' +
        'h2,.iv-h2{font-size:calc(34px*var(--ivfs)) !important;}' +
        '.hero .n{font-size:calc(64px*var(--ivfs)) !important;}' +
        '.footer .names{font-size:calc(40px*var(--ivfs)) !important;}' +
        '.footer .big{font-size:calc(30px*var(--ivfs)) !important;}' +
        '.story p,.dress p,.venue .addr,.row .d,.iv-note' +
        '{font-size:calc(15px*var(--ivfs)) !important;}' +
        '.row .t{font-size:calc(23px*var(--ivfs)) !important;}' +
        '.story .quote{font-size:calc(20px*var(--ivfs)) !important;}' +
        '.clock .num{font-size:calc(42px*var(--ivfs)) !important;}';
    }

    var el = document.getElementById('ivStyleOverride');
    if (!el) {
      el = document.createElement('style');
      el.id = 'ivStyleOverride';
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  ready(function () {
    if (!isClassic) hydrateText();
    injectStyles();
    greetGuest();
    if (!document.getElementById('rsvpForm')) injectRsvpSection();
    injectGiftSection();
    injectActionBar();
    pointRsvpLinks();
    applyCustomStyle(INV.style);
  });

  // Live preview from the couple's editor (edit.html embeds the invitation
  // in an iframe and posts style changes as they tweak the controls).
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    if (e.data && e.data.type === 'invitePreviewStyle') applyCustomStyle(e.data.style);
  });

  /* ── Text hydration (names, dates, venue) ─────────────────── */
  function hydrateText() {
    if (both) document.title = both + (INV.dateDisplay ? ' · ' + INV.dateDisplay : '');

    var heroNames = $$('.hero .n');
    if (heroNames.length >= 2) {
      heroNames[0].textContent = A;
      heroNames[1].textContent = B;
    }
    setText('.wreath-text .names', both);
    setText('.footer .names', both);
    setText('.hero .date', INV.dateDisplay);
    setText('.footer .date', INV.dateDisplay);
    setText('.wreath-text .when', INV.dateDisplay);
    setText('.hero-date', INV.dateDisplay);
    setText('.venue h2', INV.venueName);
    setText('.wreath-text .where', INV.venueName);
    if (INV.venueAddress) {
      $$('.venue .addr').forEach(function (el) {
        el.innerHTML = INV.venueAddress.split(/\n/).map(esc).join('<br>');
      });
    }
    if (INV.mapsUrl) {
      $$('.venue .btn').forEach(function (el) {
        el.href = INV.mapsUrl;
        el.target = '_blank';
        el.rel = 'noopener';
      });
    }
    if (INV.hashtag) setText('.footer .tag', '#' + String(INV.hashtag).replace(/^#/, ''));
    if (INV.rsvpBy) setText('.footer .rsvp', 'RSVP by ' + INV.rsvpBy);
  }

  /* ── Personalized guest greeting (?g=code) ────────────────── */
  function greetGuest() {
    var g = INV.guest;
    if (!g) return;
    if (document.getElementById('greeting')) return; // classic handles it

    var chip = document.createElement('div');
    chip.className = 'iv-greet';
    chip.innerHTML =
      (g.nameKm ? '<span class="iv-km">ជូនចំពោះ ' + esc(g.nameKm) + '</span>' : '') +
      '<span>Dear ' + esc(g.nameEn) + '</span>';

    var kicker = $('.hero-title .kicker');
    var wreath = $('.wreath-text');
    if (kicker) kicker.insertAdjacentElement('afterend', chip);
    else if (wreath) wreath.insertAdjacentElement('afterbegin', chip);
    else document.body.insertAdjacentElement('afterbegin', chip);
  }

  /* ── Injected RSVP + wishes wall ──────────────────────────── */
  function injectRsvpSection() {
    var sec = document.createElement('section');
    sec.className = 'iv-section';
    sec.id = 'iv-rsvp';
    var guestName = INV.guest ? INV.guest.nameEn : '';
    sec.innerHTML =
      '<div class="reveal">' +
      '<div class="iv-eyebrow">RSVP · សូមបញ្ជាក់ការចូលរួម</div>' +
      '<h2 class="iv-h2">Will you join us?</h2>' +
      '<form class="iv-form" id="ivRsvpForm">' +
      '<label>Your name · ឈ្មោះ<input name="name" required maxlength="120" value="' + esc(guestName) + '"></label>' +
      '<div class="iv-radios">' +
      '<label class="iv-radio"><input type="radio" name="attending" value="yes" checked><span>Joyfully accept · ចូលរួម</span></label>' +
      '<label class="iv-radio"><input type="radio" name="attending" value="no"><span>Regretfully decline · មិនអាចចូលរួម</span></label>' +
      '</div>' +
      '<label>Number of guests · ចំនួនភ្ញៀវ<input name="partySize" type="number" min="1" max="20" value="1"></label>' +
      '<label>A wish for the couple · ពរជូនកូនកំលោះកូនក្រមុំ<textarea name="message" rows="3" maxlength="1000"></textarea></label>' +
      '<button type="submit" class="iv-btn">Send · ផ្ញើ</button>' +
      '<div class="iv-thanks" hidden>Thank you — we can’t wait to celebrate with you! 💌<br><span class="iv-km">អរគុណច្រើន!</span></div>' +
      '</form>' +
      '<div class="iv-wishes-head">Wishes from loved ones · ពរជ័យពីមិត្តភ័ក្តិ</div>' +
      '<div id="ivWishes" class="iv-wishes"></div>' +
      '</div>';

    var footer = $('section.footer');
    if (footer) footer.parentNode.insertBefore(sec, footer);
    else document.body.appendChild(sec);

    var form = document.getElementById('ivRsvpForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      var btn = form.querySelector('.iv-btn');
      btn.disabled = true;
      fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: INV.slug,
          guestCode: INV.guest ? INV.guest.code : null,
          name: data.get('name'),
          attending: data.get('attending') === 'yes',
          partySize: data.get('partySize'),
          message: data.get('message'),
        }),
      }).then(function (res) {
        if (!res.ok) throw new Error('rsvp failed');
        Array.prototype.forEach.call(form.elements, function (el) { el.disabled = true; });
        form.querySelector('.iv-thanks').hidden = false;
        loadWishes();
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = 'Try again · សាកម្តងទៀត';
      });
    });

    loadWishes();
  }

  function loadWishes() {
    var wall = document.getElementById('ivWishes');
    if (!wall) return;
    fetch('/api/wishes?slug=' + encodeURIComponent(INV.slug))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = (data && data.wishes) || [];
        if (!list.length) {
          wall.innerHTML = '<p class="iv-empty">No wishes yet — be the first! · សូមក្លាយជាអ្នកដំបូង</p>';
          return;
        }
        wall.innerHTML = list.map(function (w) {
          return '<div class="iv-wish"><p>' + esc(w.message) + '</p><div class="iv-who">— ' + esc(w.who) + '</div></div>';
        }).join('');
      })
      .catch(function () { wall.innerHTML = ''; });
  }

  /* ── KHQR digital gift section ────────────────────────────── */
  function injectGiftSection() {
    if (!INV.khqrImage) return;
    var sec = document.createElement('section');
    sec.className = 'iv-section iv-gift';
    sec.innerHTML =
      '<div class="reveal">' +
      '<div class="iv-eyebrow">Wedding gift · ចងដៃ</div>' +
      '<h2 class="iv-h2">Send a gift with KHQR</h2>' +
      '<p class="iv-note">Your presence is the greatest gift. If you wish to send a token of love, scan with any banking app.<br><span class="iv-km">វត្តមានរបស់អ្នកគឺជាកាដូដ៏ធំបំផុត។ បើចង់ចងដៃ សូមស្កេន KHQR ខាងក្រោម។</span></p>' +
      '<img class="iv-khqr" src="' + esc(INV.khqrImage) + '" alt="KHQR code" loading="lazy">' +
      (INV.khqrName ? '<div class="iv-khqr-name">' + esc(INV.khqrName) + '</div>' : '') +
      '</div>';
    var anchor = document.getElementById('iv-rsvp') || $('section.footer');
    if (anchor) anchor.parentNode.insertBefore(sec, anchor);
    else document.body.appendChild(sec);
  }

  /* ── Calendar + share actions in the footer ───────────────── */
  function injectActionBar() {
    var host = $('section.footer .inner') || $('section.footer .reveal') || $('section.footer');
    if (!host) return;

    var bar = document.createElement('div');
    bar.className = 'iv-actions';
    bar.innerHTML =
      '<a class="iv-chip" id="ivCal" href="#" >📅 Add to calendar</a>' +
      '<a class="iv-chip" id="ivShare" href="#">📤 Share</a>';
    host.appendChild(bar);

    document.getElementById('ivCal').addEventListener('click', function (e) {
      e.preventDefault();
      var g = googleCalUrl();
      if (g) window.open(g, '_blank', 'noopener');
    });

    document.getElementById('ivShare').addEventListener('click', function (e) {
      e.preventDefault();
      var shareUrl = location.origin + '/i/' + INV.slug + '/';
      var text = both ? 'Wedding invitation — ' + both : 'Wedding invitation';
      if (navigator.share) {
        navigator.share({ title: text, url: shareUrl }).catch(function () {});
      } else {
        window.open('https://t.me/share/url?url=' + encodeURIComponent(shareUrl) +
          '&text=' + encodeURIComponent(text), '_blank', 'noopener');
      }
    });
  }

  function googleCalUrl() {
    if (!INV.dateISO) return null;
    var start = new Date(INV.dateISO);
    if (isNaN(start)) return null;
    var end = new Date(start.getTime() + 6 * 3600 * 1000);
    function fmt(d) {
      return d.toISOString().replace(/[-:]|\.\d{3}/g, '');
    }
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent((both ? both + ' — ' : '') + 'Wedding') +
      '&dates=' + fmt(start) + '/' + fmt(end) +
      '&location=' + encodeURIComponent([INV.venueName, INV.venueAddress].filter(Boolean).join(', ')) +
      '&details=' + encodeURIComponent(location.origin + '/i/' + INV.slug + '/');
  }

  // Footer "RSVP by …" buttons scroll to the injected form.
  function pointRsvpLinks() {
    var target = document.getElementById('iv-rsvp') || document.getElementById('rsvp');
    if (!target) return;
    $$('.footer .rsvp, a[href="#rsvp"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ── Styles for injected UI (inherits each template's palette
        through its CSS variables, with neutral fallbacks) ────── */
  function injectStyles() {
    var css =
      '.iv-greet{margin:18px auto 0;display:flex;flex-direction:column;gap:2px;align-items:center;' +
      'font-size:15px;letter-spacing:.06em;color:var(--ink,#333);}' +
      '.iv-greet .iv-km{font-family:"Noto Sans Khmer","Jost",sans-serif;}' +
      '.iv-km{font-family:"Noto Sans Khmer",sans-serif;}' +
      '.iv-section{background:var(--section,#f6f3ee);padding:62px 28px;text-align:center;position:relative;}' +
      '.iv-gift{background:var(--page,#fff);}' +
      '.iv-eyebrow{letter-spacing:.34em;font-size:11px;text-transform:uppercase;color:var(--deep,#8a7f6a);margin-bottom:14px;}' +
      '.iv-h2{font-family:"Cormorant Garamond",serif;font-weight:500;font-size:32px;color:var(--ink,#333);margin:0 0 22px;}' +
      '.iv-form{max-width:340px;margin:0 auto;text-align:left;display:flex;flex-direction:column;gap:14px;}' +
      '.iv-form label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--sub,#888);}' +
      '.iv-form input,.iv-form textarea{font-family:inherit;font-size:15px;color:var(--ink,#333);background:var(--page,#fff);' +
      'border:1px solid var(--line,#ddd);border-radius:10px;padding:11px 13px;outline:none;}' +
      '.iv-form input:focus,.iv-form textarea:focus{border-color:var(--deep,#8a7f6a);}' +
      '.iv-radios{display:flex;flex-direction:column;gap:8px;}' +
      '.iv-radio{flex-direction:row!important;align-items:center;text-transform:none!important;letter-spacing:0!important;' +
      'font-size:14px!important;color:var(--ink,#333)!important;gap:9px!important;border:1px solid var(--line,#ddd);' +
      'border-radius:10px;padding:11px 13px;cursor:pointer;background:var(--page,#fff);}' +
      '.iv-radio input{accent-color:var(--deep,#8a7f6a);}' +
      '.iv-btn{margin-top:4px;cursor:pointer;font-family:inherit;letter-spacing:.16em;font-size:12px;text-transform:uppercase;' +
      'color:var(--ondark,#fff);background:var(--deep,#8a7f6a);border:0;border-radius:100px;padding:14px 26px;}' +
      '.iv-btn:disabled{opacity:.6;cursor:default;}' +
      '.iv-thanks{text-align:center;font-size:15px;line-height:1.7;color:var(--ink,#333);padding:8px 0;}' +
      '.iv-wishes-head{margin:44px 0 16px;letter-spacing:.2em;font-size:11px;text-transform:uppercase;color:var(--sub,#888);}' +
      '.iv-wishes{max-width:360px;margin:0 auto;display:flex;flex-direction:column;gap:10px;text-align:left;}' +
      '.iv-wish{background:var(--page,#fff);border:1px solid var(--line,#ddd);border-radius:12px;padding:13px 16px;}' +
      '.iv-wish p{margin:0 0 6px;font-size:14px;line-height:1.6;color:var(--ink,#333);}' +
      '.iv-who{font-size:12px;color:var(--sub,#888);}' +
      '.iv-empty{font-size:13px;color:var(--sub,#888);font-style:italic;}' +
      '.iv-note{max-width:300px;margin:0 auto 22px;font-weight:300;font-size:14px;line-height:1.75;color:var(--sub,#888);}' +
      '.iv-khqr{width:210px;max-width:70%;border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.12);}' +
      '.iv-khqr-name{margin-top:12px;letter-spacing:.12em;font-size:12px;text-transform:uppercase;color:var(--ink,#333);}' +
      '.iv-actions{display:flex;justify-content:center;gap:10px;margin-top:22px;flex-wrap:wrap;}' +
      '.iv-chip{letter-spacing:.1em;font-size:11px;text-transform:uppercase;text-decoration:none;' +
      'color:var(--ondark,#fff);border:1px solid var(--ondark,#fff);border-radius:100px;padding:10px 18px;opacity:.92;}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Khmer glyph support for the injected bilingual labels.
    var font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@300;400&display=swap';
    document.head.appendChild(font);
  }
})();
