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

  // The couple's story is a real multi-paragraph text now, but templates ship
  // a single <p>. Keep their blank lines as paragraph breaks and single
  // newlines as line breaks, escaping first so typed text can't inject markup.
  function setStory(sel, value) {
    if (!value) return;
    // Spans, not <p> — the target is already a <p> and nesting one inside
    // another makes the browser close it early and leave a stray empty node.
    var html = String(value).replace(/\r\n?/g, '\n').split(/\n{2,}/)
      .map(function (para) {
        return '<span class="iv-story-p">' + para.split('\n').map(esc).join('<br>') + '</span>';
      })
      .join('');
    $$(sel).forEach(function (el) { el.innerHTML = html; });
  }

  // classic-elegance runs its own bilingual data-en/data-km system and has
  // native RSVP/wishes forms. Its script.js reads the story/schedule/photo
  // fields from window.INVITE itself; the remaining text is hydrated by
  // hydrateClassic() below, which speaks that template's markup conventions.
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
    if (isClassic) hydrateClassic();
    else hydrateText();
    if (INV.heroImage) hydrateHero(INV.heroImage);
    if (INV.storyImage) hydrateStory(INV.storyImage);
    hydrateCouple();
    hydrateFront();
    hydrateVenueMap();
    if (Array.isArray(INV.schedule) && INV.schedule.length) hydrateSchedule(INV.schedule);
    if (Array.isArray(INV.gallery) && INV.gallery.length) hydrateGallery(INV.gallery);
    injectStyles();
    injectMusic();
    greetGuest();
    // RSVP + wishes section removed at the couple's request. Restore by
    // re-enabling this line; injectRsvpSection() is left intact below.
    // if (!document.getElementById('rsvpForm')) injectRsvpSection();
    injectGiftSection();
    injectActionBar();
    pointRsvpLinks();
    applyCustomStyle(INV.style);
  });

  // Live preview from the couple's editor (edit.html embeds the invitation
  // in an iframe and posts style/schedule/story/photo changes as they edit).
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    if (!e.data) return;
    if (e.data.type === 'invitePreviewStyle') applyCustomStyle(e.data.style);
    if (e.data.type === 'invitePreviewData') applyPreviewData(e.data);
  });

  var PREVIEW_FIELDS = ['coupleA', 'coupleB', 'coupleAKm', 'coupleBKm', 'dateISO',
    'venueName', 'venueAddress', 'mapsUrl', 'hashtag'];

  // Mirrors the server's deriveDateDisplay() so the preview shows the same
  // formatting the invitation will have once the couple saves.
  function previewDateDisplay(dateISO) {
    var d = new Date(dateISO);
    if (isNaN(d.getTime())) return null;
    var pad = function (n) { return String(n).length < 2 ? '0' + n : String(n); };
    return pad(d.getDate()) + ' · ' + pad(d.getMonth() + 1) + ' · ' + d.getFullYear();
  }

  function applyPreviewData(d) {
    // Merge the in-progress edits into INV, then re-run the same hydration the
    // published page uses — so the preview matches what saving will produce.
    PREVIEW_FIELDS.forEach(function (k) {
      if (typeof d[k] === 'string') INV[k] = d[k];
    });
    ['groomImage', 'brideImage', 'animeImage', 'groomNowImage', 'brideNowImage'].forEach(function (k) {
      if (typeof d[k] === 'string') INV[k] = d[k];
    });
    if (d.galleryCaptions && typeof d.galleryCaptions === 'object') {
      INV.galleryCaptions = d.galleryCaptions;
    }
    if (typeof d.dateISO === 'string') {
      INV.dateDisplay = previewDateDisplay(d.dateISO) || INV.dateDisplay;
    }
    A = INV.coupleA || '';
    B = INV.coupleB || '';
    both = A && B ? A + ' & ' + B : '';

    if (isClassic) {
      hydrateClassic();
      // classic-elegance ships its own renderers for these; its markup doesn't
      // match the generic selectors below.
      if (d.story && window.renderStory) window.renderStory(d.story);
      if (Array.isArray(d.schedule) && d.schedule.length && window.renderSchedule) {
        window.renderSchedule(d.schedule);
      }
      if (window.renderHero) window.renderHero(d.heroImage || '');
      if (Array.isArray(d.gallery) && window.renderGallery) window.renderGallery(d.gallery);
      return;
    }

    hydrateText();
    if (d.story) setStory('.story p', d.story);
    if (Array.isArray(d.schedule) && d.schedule.length) hydrateSchedule(d.schedule);
    hydrateHero(d.heroImage || '');
    hydrateStory(d.storyImage || '');
    hydrateCouple();
    hydrateFront();
    hydrateVenueMap();
    if (Array.isArray(d.gallery)) hydrateGallery(d.gallery);
  }

  /* ── Order-of-the-day schedule (couple's custom event list) ──
       Templates ship 4 sample rows under .schedule .row; when the
       couple has customized their schedule, replace them wholesale. */
  // Khmer script sets much larger than Latin at the same font-size, so a
  // schedule typed in Khmer overflows the row and wraps. Tag those cells and
  // let the injected CSS bring them back down.
  // The pattern lives inside the function on purpose: ready() runs
  // synchronously from higher up in this file, before any `var` down here has
  // been assigned, so a module-level regex would still be undefined here.
  function kmClass(text) {
    return /[ក-៿]/.test(text || '') ? ' iv-km' : '';
  }

  function hydrateSchedule(items) {
    var rows = $$('.schedule .row');
    if (!rows.length) return;
    var container = rows[0].parentNode;
    container.innerHTML = items.map(function (it) {
      return '<div class="row"><div class="time' + kmClass(it.time) + '">' + esc(it.time) + '</div>' +
        '<div class="body"><div class="dot"></div>' +
        '<div class="t' + kmClass(it.title) + '">' + esc(it.title) + '</div>' +
        '<div class="d' + kmClass(it.desc) + '">' + esc(it.desc) + '</div></div></div>';
    }).join('');
  }

  /* ── Hero + gallery photos (couple's own uploads) ──────────
       Both slots are placeholder .ph boxes with a CSS rule that
       hides the "photo" label as soon as a background-image is
       set inline — so we only ever need to touch .style. */
  // The story section's portrait frame. Templates ship it as a .ph
  // placeholder reading "your photo"; without this it stayed on screen for
  // guests, since nothing ever filled it.
  function hydrateStory(photoUrl) {
    var frame = $('.story .frame .ph') || $('.story .frame');
    if (!frame) return;
    frame.style.backgroundImage = photoUrl ? 'url(' + JSON.stringify(photoUrl) + ')' : '';
    frame.style.backgroundSize = photoUrl ? 'cover' : '';
    frame.style.backgroundPosition = photoUrl ? 'center 38%' : '';
  }

  /* ── Venue map ────────────────────────────────────────────
       Templates ship a "map / venue photo" placeholder that nothing filled.
       Google's embed endpoint needs no API key (classic-elegance already
       uses it), so the couple's own address is enough to draw a real map. */

  // Coordinates from the couple's pasted link are the most precise thing we
  // have; fall back to the written address. Short links (maps.app.goo.gl)
  // carry no query, so they stay on the "Get directions" button instead.
  function mapQuery() {
    var link = String(INV.mapsUrl || '');
    var N = '(-?\\d+(?:\\.\\d+)?)';
    // !3d/!4d is the place's true pin; @lat,lng is only the camera centre, so
    // prefer the former. ?q=, ?ll= and a bare "lat,lng" paste also work.
    var pin = link.match(new RegExp('!3d' + N + '!4d' + N)) ||
              link.match(new RegExp('[?&](?:q|ll|daddr|destination)=' + N + '%2C' + N)) ||
              link.match(new RegExp('[?&](?:q|ll|daddr|destination)=' + N + ',' + N)) ||
              link.match(new RegExp('@' + N + ',' + N)) ||
              link.match(new RegExp('^\\s*' + N + ',\\s*' + N + '\\s*$'));
    if (pin) return pin[1] + ',' + pin[2];
    var written = [INV.venueName, INV.venueAddress].filter(Boolean).join(', ');
    written = written.replace(/\s*\n\s*/g, ', ').trim();
    return written || null;
  }

  var lastMapQuery = null;
  function hydrateVenueMap() {
    var box = $('.venue .map');
    if (!box) return;
    var q = mapQuery();
    // Leave the template's placeholder alone when there's nothing to show,
    // and don't rebuild the iframe on every keystroke in the live preview.
    if (!q || q === lastMapQuery) return;
    lastMapQuery = q;

    var frame = box.querySelector('iframe.iv-map');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'iv-map';
      frame.title = 'Venue map';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.setAttribute('allowfullscreen', '');
      frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
      box.innerHTML = '';
      box.appendChild(frame);
    }
    frame.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed';
  }

  // Single-slot photos that live in their own element (the couple section's
  // groom / bride / illustrated portrait). Untouched when no photo is set, so
  // the template's placeholder stays.
  function hydrateSlotPhoto(id, photoUrl) {
    var el = document.getElementById(id);
    if (!el || !photoUrl) return;
    el.style.backgroundImage = 'url(' + JSON.stringify(photoUrl) + ')';
  }

  // Cover copy for templates whose front page carries the couple's greeting
  // (.hero-front). Fills from their own details; the hashtag line disappears
  // when they haven't set one.
  function hydrateFront() {
    var box = $('.hero-front');
    if (!box) return;
    setText('.hero-front .fw-names', both);
    setText('.hero-front .fw-meta', INV.dateDisplay);
    var tag = box.querySelector('.fw-tag');
    if (tag) {
      var hashtag = String(INV.hashtag || '').replace(/^#/, '');
      tag.hidden = !hashtag;
      if (hashtag) tag.textContent = '#' + hashtag;
    }
  }

  function hydrateCouple() {
    // Row 1: the two of them as babies, either side of a couple photo.
    hydrateSlotPhoto('groomPh', INV.groomImage);
    hydrateSlotPhoto('animePh', INV.animeImage);
    hydrateSlotPhoto('bridePh', INV.brideImage);
    // Row 2: the two of them today.
    hydrateSlotPhoto('groomNowPh', INV.groomNowImage);
    hydrateSlotPhoto('brideNowPh', INV.brideNowImage);
    setText('.couple .groom-name', A);
    setText('.couple .bride-name', B);
  }

  function hydrateHero(photoUrl) {
    var bg = document.getElementById('heroBg') || $('.hero-bg');
    if (bg) bg.style.backgroundImage = photoUrl ? 'url(' + JSON.stringify(photoUrl) + ')' : '';
  }
  // Tracks how many .ph tiles the template shipped with, so clearing the
  // couple's photos reverts to those placeholders instead of deleting them.
  var galleryBaseline = null;
  /* Templates lay the gallery out on fixed rows (grid-auto-rows), so a photo
     dropped into a mismatched slot gets centre-cropped — and since faces sit
     in the upper third, centre-cropping is exactly what beheads people.
     Each photo is measured once, then the tile is reshaped to match it and the
     crop is biased upward. Everything degrades to the old behaviour if the
     image can't be measured. */
  // How tall a tile of N rows actually is, read from the template's own grid
  // rather than assumed — row height and gap differ between templates.
  function slotRatio(grid, frame, span) {
    var cs = window.getComputedStyle(grid);
    var rowH = parseFloat(cs.gridAutoRows);
    var gap = parseFloat(cs.rowGap);
    var colW = frame.offsetWidth;
    if (!rowH || !colW) return null;
    return (span * rowH + (span - 1) * (gap || 0)) / colW;
  }

  function shapeFrame(grid, frame, photoUrl) {
    var probe = new Image();
    probe.onload = function () {
      var w = probe.naturalWidth, h = probe.naturalHeight;
      if (!w || !h) return;
      var ratio = h / w;

      // Pick the row span whose resulting slot is closest in shape to the
      // photo, so the crop is as shallow as possible. Compared in log space so
      // "twice as tall" and "half as tall" count as equally wrong.
      var MAX_SPAN = 3; // kept local — see the hoisting note on kmClass above
      var best = null, bestErr = Infinity;
      for (var span = 1; span <= MAX_SPAN; span++) {
        var sr = slotRatio(grid, frame, span);
        if (!sr) continue;
        var err = Math.abs(Math.log(ratio / sr));
        if (err < bestErr) { bestErr = err; best = span; }
      }
      if (best) {
        frame.style.gridRow = 'span ' + best;
        frame.classList.toggle('iv-tall', best > 1);
      }

      // Faces cluster above centre, so bias the crop upward — but only as far
      // as the leftover overflow allows, otherwise we'd pan past the subject.
      // Only steer the crop when we actually know the slot's shape. Templates
      // that lay the gallery out some other way (a timeline, say) set their own
      // focal point in CSS, and an inline value here would override it.
      var slot = best ? slotRatio(grid, frame, best) : null;
      if (slot && ratio > slot) {
        var overflow = 1 - slot / ratio;              // fraction cropped away
        var focus = Math.max(25, 50 - overflow * 100);
        frame.style.backgroundPosition = 'center ' + Math.round(focus) + '%';
      }
    };
    probe.src = photoUrl;
  }

  // A caption lives inside its own tile, so it travels with the photo however
  // the template lays the gallery out. Keyed by URL, so reordering is free.
  function setCaption(frame, text) {
    var cap = frame.querySelector('.iv-cap');
    if (!text) { if (cap) cap.remove(); return; }
    if (!cap) {
      cap = document.createElement('div');
      cap.className = 'iv-cap';
      frame.appendChild(cap);
    }
    cap.textContent = text;
  }

  function hydrateGallery(urls) {
    var grid = $('.gallery .grid');
    if (!grid) return;
    var caps = (INV.galleryCaptions && typeof INV.galleryCaptions === 'object')
      ? INV.galleryCaptions : {};
    var frames = Array.prototype.slice.call(grid.querySelectorAll('.ph'));
    if (galleryBaseline === null) galleryBaseline = frames.length;
    grid.classList.toggle('iv-shaped', urls.length > 0);
    urls.forEach(function (photoUrl, i) {
      var frame = frames[i];
      if (!frame) {
        frame = document.createElement('div');
        frame.className = 'ph';
        grid.appendChild(frame);
        frames.push(frame);
      }
      frame.style.backgroundImage = 'url(' + JSON.stringify(photoUrl) + ')';
      setCaption(frame, caps[photoUrl]);
      shapeFrame(grid, frame, photoUrl);
    });
    for (var j = urls.length; j < frames.length; j++) {
      if (j < galleryBaseline) {
        // Back to the template's own sample tile: drop everything we set.
        frames[j].style.backgroundImage = '';
        setCaption(frames[j], '');
        frames[j].style.gridRow = '';
        frames[j].style.backgroundPosition = '';
        frames[j].classList.remove('iv-tall');
      } else {
        frames[j].remove();
      }
    }
  }

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
    if (INV.story) setStory('.story p', INV.story);
  }

  /* ── Text hydration for classic-elegance ──────────────────────
       This template uses its own markup conventions (.hero-names,
       .fnames) and a bilingual data-en/data-km system, so the generic
       hydrateText() above neither matches its selectors nor survives a
       language switch. Its own script.js reads only the story/schedule/
       photo fields from window.INVITE, so without this the couple's
       names, date and venue never reach the page.

       Every write sets BOTH data-en and data-km alongside the visible
       markup: setLang() re-applies innerHTML from those attributes on
       each toggle, so a plain textContent write would be wiped the
       moment a guest switches language. ── */
  // The digit table lives inside the function on purpose: ready() runs
  // synchronously from higher up in this file, before any `var` down here has
  // been assigned, so a module-level table would still be undefined at call time.
  function toKmDigits(s) {
    var digits = '០១២៣៤៥៦៧៨៩';
    return String(s).replace(/[0-9]/g, function (d) { return digits[+d]; });
  }

  // enHtml/kmHtml are trusted markup built from escaped values above.
  function setBilingual(sel, enHtml, kmHtml) {
    var el = $(sel);
    if (!el || !enHtml) return;
    var km = kmHtml || enHtml;
    el.setAttribute('data-en', enHtml);
    el.setAttribute('data-km', km);
    // script.js has already run setLang(), so honour the language on screen.
    el.innerHTML = document.documentElement.lang === 'km' ? km : enHtml;
  }

  function hydrateClassic() {
    var kmA = INV.coupleAKm || A;
    var kmB = INV.coupleBKm || B;
    var bothKm = kmA && kmB ? kmA + ' & ' + kmB : '';

    if (both) document.title = both + (INV.dateDisplay ? ' · ' + INV.dateDisplay : '');

    if (A && B) {
      setBilingual('.hero-names',
        esc(A) + '<span class="hero-amp">and</span>' + esc(B),
        esc(kmA) + '<span class="hero-amp">និង</span>' + esc(kmB));
    }
    setBilingual('.fnames', esc(both), esc(bothKm));

    // The template wraps each separator in <span class="dot"> for spacing.
    if (INV.dateDisplay) {
      var dots = function (s) { return esc(s).replace(/·/g, '<span class="dot">·</span>'); };
      setBilingual('.hero-date', dots(INV.dateDisplay), dots(toKmDigits(INV.dateDisplay)));
    }

    var metaEn = [INV.dateDisplay, INV.venueName].filter(Boolean);
    if (metaEn.length) {
      var metaKm = [toKmDigits(INV.dateDisplay || ''), INV.venueName].filter(Boolean);
      setBilingual('.fmeta', metaEn.map(esc).join('&nbsp;·&nbsp;'),
        metaKm.map(esc).join('&nbsp;·&nbsp;'));
    }

    // The template ships a sample hashtag; hide the line outright when the
    // couple hasn't set one, so the placeholder never reaches a live invite.
    var tag = $('.ftag');
    if (tag) {
      var hashtag = String(INV.hashtag || '').replace(/^#/, '');
      tag.hidden = !hashtag;
      if (hashtag) setBilingual('.ftag', '#' + esc(hashtag));
    }

    // No Khmer variants are collected for the venue, so both languages
    // share one value — the same approach script.js takes for the story.
    setBilingual('.venue-info h3', esc(INV.venueName));
    if (INV.venueAddress) {
      setBilingual('.venue-info .addr', INV.venueAddress.split(/\n/).map(esc).join('<br>'));
    }

    if (INV.mapsUrl) {
      var btn = $('.venue-card a.btn-primary');
      if (btn) {
        btn.href = INV.mapsUrl;
        btn.target = '_blank';
        btn.rel = 'noopener';
      }
    }

    // classic ships its own <iframe class="map-embed">, so it only needs a
    // new src — same query rules as every other template.
    var q = mapQuery();
    var map = $('.map-embed');
    if (q && map) {
      map.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed';
    }
  }

  /* ── Personalized guest greeting (?g=code) ────────────────── */
  function greetGuest() {
    var g = INV.guest;
    if (!g) return;
    if (document.getElementById('greeting')) return; // classic handles it

    var chip = document.createElement('div');
    chip.className = 'iv-greet';
    // Three lines: the honorific, then the guest's Khmer name on its own line,
    // then the English form. .iv-greet is a flex column, so each span is a line.
    chip.innerHTML =
      (g.nameKm
        ? '<span class="iv-km iv-greet-lead">សូមគោរពអញ្ជើញ</span>' +
          '<span class="iv-km iv-greet-name">' + esc(g.nameKm) + '</span>'
        : '') +
      '<span class="iv-greet-en">Dear ' + esc(g.nameEn) + '</span>';

    // Land the greeting inside the template's own cover. The last resort used
    // to be document.body, which dropped it outside the invitation card
    // entirely on any template without .hero-title or .wreath-text.
    var front = $('.hero-front');            // covers that lead with a greeting
    var kicker = $('.hero-title .kicker');
    var wreath = $('.wreath-text');
    var heroCopy = $('.hero .hero-copy') || $('.hero');
    if (front) front.insertAdjacentElement('afterbegin', chip);
    else if (kicker) kicker.insertAdjacentElement('afterend', chip);
    else if (wreath) wreath.insertAdjacentElement('afterbegin', chip);
    else if (heroCopy) heroCopy.insertAdjacentElement('afterbegin', chip);
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

  /* ── Background music ──────────────────────────────────────
       Plays by default. Browsers refuse to start audio before the
       visitor has interacted with the page, so we attempt it straight
       away and then retry on the first gesture — the "បើកធៀប" tap,
       a scroll, anything. Templates shipping their own player
       (classic-elegance) are left alone. */
  function injectMusic() {
    if (!INV.musicUrl) return;
    if (document.getElementById('bgMusic')) return; // template has its own

    var audio = document.createElement('audio');
    audio.id = 'ivMusic';
    audio.loop = true;
    audio.preload = 'auto';
    audio.src = INV.musicUrl;
    document.body.appendChild(audio);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'iv-music';
    btn.innerHTML = '<span class="iv-music-ico">♪</span>';
    document.body.appendChild(btn);

    // Drive the button off the audio's real state, so it can never claim to
    // be playing when the browser quietly refused to start.
    function sync() {
      var on = !audio.paused;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
    }
    audio.addEventListener('play', sync);
    audio.addEventListener('pause', sync);
    sync();

    // Once a guest turns it off it stays off — no gesture may restart it.
    var mutedByGuest = false;

    function tryPlay() {
      if (mutedByGuest || !audio.paused) return;
      var p = audio.play();
      if (p && p.catch) p.catch(function () { /* needs a gesture; retried below */ });
    }

    btn.addEventListener('click', function () {
      if (audio.paused) { mutedByGuest = false; tryPlay(); }
      else { mutedByGuest = true; audio.pause(); }
    });

    var GESTURES = ['pointerdown', 'touchstart', 'click', 'keydown', 'scroll'];
    function onGesture() {
      tryPlay();
      if (!audio.paused || mutedByGuest) {
        GESTURES.forEach(function (ev) { window.removeEventListener(ev, onGesture, true); });
      }
    }
    GESTURES.forEach(function (ev) {
      window.addEventListener(ev, onGesture, { passive: true, capture: true });
    });

    tryPlay(); // desktop browsers with prior engagement start here
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
      // Reshaped gallery tiles vary in row span, which leaves holes under the
      // default sparse flow; dense back-fills them. Scoped to galleries we
      // actually reshaped, so a template's own sample grid is left alone.
      '.gallery .grid.iv-shaped{grid-auto-flow:dense;}' +
      '.iv-cap{font-size:12.5px;line-height:1.6;color:var(--sub,#888);}' +
      '.iv-music{position:fixed;right:16px;bottom:16px;z-index:60;width:46px;height:46px;border-radius:50%;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
      'background:var(--page,#fff);color:var(--deep,#8a7f6a);border:1px solid var(--line,#e3ddd2);' +
      'box-shadow:0 8px 22px rgba(0,0,0,.18);transition:transform .2s ease;}' +
      '.iv-music:hover{transform:scale(1.06);}' +
      '.iv-music .iv-music-ico{font-size:19px;line-height:1;}' +
      '.iv-music.on{background:var(--deep,#8a7f6a);color:var(--page,#fff);}' +
      '.iv-music.on .iv-music-ico{animation:ivPulse 1.6s ease-in-out infinite;}' +
      '@keyframes ivPulse{0%,100%{opacity:1;}50%{opacity:.45;}}' +
      // Paragraph spacing for the couple's longer story text.
      '.iv-story-p{display:block;}' +
      '.iv-story-p + .iv-story-p{margin-top:1em;}' +
      // Khmer runs ~30% larger than Latin at a given size and needs more line
      // height; scale the schedule's Khmer cells down so rows stay one line.
      '.schedule .row .t.iv-km{font-size:17px;line-height:1.6;}' +
      '.schedule .row .d.iv-km{font-size:12px;line-height:1.7;}' +
      '.schedule .row .time.iv-km{font-size:15px;line-height:1.5;}' +
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
