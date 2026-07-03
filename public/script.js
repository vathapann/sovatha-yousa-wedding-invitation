/* ═══════════════════════════════════════════════════════════════
   Yousa & Sovatha — wedding invitation interactivity
   All front-end. Guestbook & photo previews use the browser only;
   see the "BACKEND" notes to collect data for everyone.
   ═══════════════════════════════════════════════════════════════ */

// EDIT: your wedding date/time (local). Format: YYYY, MM-1, DD, HH, MM
const WEDDING_DATE = new Date(2026, 10, 22, 16, 0, 0); // 22 Nov 2026, 4:00pm

// EDIT: your shared photo album link (Google Photos / Immich / etc.)
const ALBUM_URL = 'https://photos.example.com/share/XXXXXXXX';

/* ─────────────────────────────────────────────
   Language toggle (EN / KM)
   ───────────────────────────────────────────── */
const COUNTDOWN_DONE = { en: 'Today is the day 💙', km: 'ថ្ងៃនេះគឺជាថ្ងៃពិសេស 💙' };
let currentLang = localStorage.getItem('lang') || 'en';

function setLang(lang){
  currentLang = lang;
  document.documentElement.lang = lang;
  document.body.classList.toggle('km', lang === 'km');
  document.querySelectorAll('[data-en]').forEach(el => {
    const v = el.getAttribute('data-' + lang);
    if(v !== null) el.innerHTML = v;
  });
  document.getElementById('langToggle').textContent = lang === 'en' ? 'ខ្មែរ' : 'English';
  localStorage.setItem('lang', lang);
}

document.getElementById('langToggle').addEventListener('click', () => {
  setLang(currentLang === 'en' ? 'km' : 'en');
});

/* ─────────────────────────────────────────────
   Personalized greeting (?g=ID)
   ───────────────────────────────────────────── */
// EDIT: add your guests, or wire this to a Google Sheet CSV (see previous version).
const GUESTS = {
  'a3f9': { en: 'Dear Sophea Family', km: 'ជូនចំពោះ គ្រួសារ សុភា' },
  'b1c7': { en: 'Dear Dara & Lin',    km: 'ជូនចំពោះ ដារ៉ា និង លីន' },
};
function applyGreeting(){
  const el = document.getElementById('greeting');
  if(!el) return;
  const g = GUESTS[new URLSearchParams(location.search).get('g')];
  if(!g) return;
  el.setAttribute('data-en', g.en);
  el.setAttribute('data-km', g.km || g.en);
  el.innerHTML = g[currentLang] || g.en;
  el.hidden = false;
}

/* ─────────────────────────────────────────────
   Open Invitation button — scroll into the invitation
   ───────────────────────────────────────────── */
const openBtn = document.getElementById('openInvitation');
if(openBtn) openBtn.addEventListener('click', () => {
  const first = document.querySelector('.hero + section') || document.querySelector('section');
  if(first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

applyGreeting();
setLang(currentLang);

/* ─────────────────────────────────────────────
   Countdown timer
   ───────────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');
let timer;
function tick(){
  const diff = WEDDING_DATE - new Date();
  if(diff <= 0){
    document.getElementById('countdown').innerHTML =
      '<p class="script" style="font-size:2rem;">' + COUNTDOWN_DONE[currentLang] + '</p>';
    return clearInterval(timer);
  }
  document.getElementById('cd-days').textContent  = Math.floor(diff / 86400000);
  document.getElementById('cd-hours').textContent = pad(Math.floor(diff % 86400000 / 3600000));
  document.getElementById('cd-mins').textContent  = pad(Math.floor(diff % 3600000 / 60000));
  document.getElementById('cd-secs').textContent  = pad(Math.floor(diff % 60000 / 1000));
}
tick();
timer = setInterval(tick, 1000);

/* ─────────────────────────────────────────────
   Scroll reveal
   ───────────────────────────────────────────── */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ─────────────────────────────────────────────
   Background music (with mute toggle)
   ───────────────────────────────────────────── */
const music = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');
const musicIcon = document.getElementById('musicIcon');
const ICON_ON  = '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>';
const ICON_OFF = '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" y1="2" x2="22" y2="22"/>';
let musicOn = false;

function setMusic(on){
  musicOn = on;
  if(on){
    music.play().catch(() => {}); // browsers block autoplay until a tap — this runs on click, so it's fine
    musicBtn.classList.add('playing');
    musicIcon.innerHTML = ICON_ON;
    musicBtn.setAttribute('aria-label', 'Mute music');
  } else {
    music.pause();
    musicBtn.classList.remove('playing');
    musicIcon.innerHTML = ICON_OFF;
    musicBtn.setAttribute('aria-label', 'Play music');
  }
}
if(musicBtn){
  musicBtn.addEventListener('click', () => setMusic(!musicOn));
  // Try to start softly on the guest's first interaction anywhere on the page.
  window.addEventListener('pointerdown', function once(){
    window.removeEventListener('pointerdown', once);
    if(!musicOn && music.getAttribute('src')) setMusic(true);
  }, { once: true });
}

/* ─────────────────────────────────────────────
   Photo gallery lightbox
   ───────────────────────────────────────────── */
const galleryImgs = Array.from(document.querySelectorAll('#gallery img'));
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
let lbIndex = 0;

function openLightbox(i){
  lbIndex = (i + galleryImgs.length) % galleryImgs.length;
  lbImg.src = galleryImgs[lbIndex].src;
  lbImg.alt = galleryImgs[lbIndex].alt;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
}
function closeLightbox(){ lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden', 'true'); }

galleryImgs.forEach((img, i) => img.addEventListener('click', () => openLightbox(i)));
document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => openLightbox(lbIndex - 1));
document.getElementById('lbNext').addEventListener('click', () => openLightbox(lbIndex + 1));
lightbox.addEventListener('click', e => { if(e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => {
  if(!lightbox.classList.contains('open')) return;
  if(e.key === 'Escape') closeLightbox();
  if(e.key === 'ArrowRight') openLightbox(lbIndex + 1);
  if(e.key === 'ArrowLeft') openLightbox(lbIndex - 1);
});

/* ─────────────────────────────────────────────
   RSVP form
   BACKEND: to actually store replies, POST `data` to a Cloudflare
   Worker route (/api/rsvp → D1/KV) or a Formspree endpoint.
   ───────────────────────────────────────────── */
const rsvpForm = document.getElementById('rsvpForm');
if(rsvpForm) rsvpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!rsvpForm.reportValidity()) return;
  const data = Object.fromEntries(new FormData(rsvpForm).entries());
  try {
    // await fetch('/api/rsvp', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    const saved = JSON.parse(localStorage.getItem('rsvps') || '[]');
    saved.push({ ...data, at: Date.now() });
    localStorage.setItem('rsvps', JSON.stringify(saved));
    console.log('RSVP (stored locally):', data);
  } catch(err){ console.error('RSVP failed', err); }
  rsvpForm.style.display = 'none';
  document.getElementById('rsvpThanks').classList.add('show');
  document.getElementById('rsvpThanks').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

/* ─────────────────────────────────────────────
   Guestbook / wishes
   BACKEND: swap the localStorage calls for a Worker route
   (/api/wishes GET+POST → D1) so every guest sees the same wall.
   ───────────────────────────────────────────── */
const wishForm = document.getElementById('wishForm');
const wishesEl = document.getElementById('wishes');

function loadWishes(){ return JSON.parse(localStorage.getItem('wishes') || '[]'); }
function saveWishes(list){ localStorage.setItem('wishes', JSON.stringify(list)); }
function escapeHTML(s){ const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renderWishes(){
  const list = loadWishes();
  if(!list.length){
    const empty = currentLang === 'km' ? 'នៅមិនទាន់មានពរ — សូមក្លាយជាអ្នកដំបូង!' : 'No wishes yet — be the first to write one!';
    wishesEl.innerHTML = '<p class="wishes-empty">' + empty + '</p>';
    return;
  }
  wishesEl.innerHTML = list.slice().reverse().map(w =>
    '<div class="wish"><p>' + escapeHTML(w.message) + '</p><div class="who">' + escapeHTML(w.who) + '</div></div>'
  ).join('');
}

if(wishForm){
  wishForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if(!wishForm.reportValidity()) return;
    const data = Object.fromEntries(new FormData(wishForm).entries());
    const list = loadWishes();
    list.push({ who: data.who.trim(), message: data.message.trim(), at: Date.now() });
    saveWishes(list);
    wishForm.reset();
    renderWishes();
    wishesEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  renderWishes();
}

/* ─────────────────────────────────────────────
   Guest photo sharing (local previews)
   BACKEND: to collect photos for everyone, upload each file to an
   R2 bucket via a Worker (/api/upload) or point guests to ALBUM_URL.
   ───────────────────────────────────────────── */
const albumLink = document.getElementById('albumLink');
if(albumLink) albumLink.href = ALBUM_URL;

const shareDrop = document.getElementById('shareDrop');
const shareInput = document.getElementById('shareInput');
const sharePreview = document.getElementById('sharePreview');

function addPhotos(files){
  Array.from(files).filter(f => f.type.startsWith('image/')).forEach(file => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = 'Shared photo';
    img.onload = () => URL.revokeObjectURL(img.src);
    sharePreview.appendChild(img);
    // BACKEND: send `file` to your Worker here, e.g.
    // fetch('/api/upload', { method:'POST', body:file });
  });
}
if(shareDrop){
  shareDrop.addEventListener('click', () => shareInput.click());
  shareDrop.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); shareInput.click(); } });
  shareInput.addEventListener('change', () => addPhotos(shareInput.files));
  ['dragover', 'dragenter'].forEach(ev => shareDrop.addEventListener(ev, e => { e.preventDefault(); shareDrop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => shareDrop.addEventListener(ev, e => { e.preventDefault(); shareDrop.classList.remove('drag'); }));
  shareDrop.addEventListener('drop', e => { if(e.dataTransfer) addPhotos(e.dataTransfer.files); });
}

// Re-render language-sensitive dynamic bits when the language changes.
document.getElementById('langToggle').addEventListener('click', () => { if(wishForm) renderWishes(); });
