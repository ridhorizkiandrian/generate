/* ============================================================
   THEME SYSTEM — Generate Soal Ujian
   File: theme.js (v5)
   - Mengelola 6 tema: default, dark, sunset, neubrutalism,
     paper, neumorphism
     (Glass & Liquid Glass DIHAPUS — backdrop-filter blur di
     banyak elemen sekaligus terlalu berat & rawan glitch di
     WebView mobile low-end)
   - Simpan/load pilihan via localStorage
   - Transisi fade halus & AMAN (opacity body saja — lihat
     theme.css section 1 untuk alasan kenapa View Transitions
     API & animasi backdrop-filter sengaja TIDAK dipakai)
   - Anti-bug: guard tema sama, guard transisi tumpang-tindih,
     guard id tema tidak valid, hormat prefers-reduced-motion
   - TIDAK mengubah fitur atau logika aplikasi yang sudah ada
   ============================================================ */

(function () {
  'use strict';

  /* ── Konstanta ── */
  const THEME_KEY = 'generateSoalTheme';
  const THEMES = [
    {
      id:    'default',
      nameId:'Tema Default',
      nameEn:'Default Theme',
      descId:'Tampilan asli website, bersih dan profesional.',
      descEn:'Original website appearance, clean and professional.',
      preview:'tp-default',
    },
    {
      id:    'dark',
      nameId:'Dark Mode',
      nameEn:'Dark Mode',
      descId:'Latar gelap elegan, nyaman di mata saat malam hari.',
      descEn:'Elegant dark background, easy on the eyes at night.',
      preview:'tp-dark',
    },
    {
      id:    'sunset',
      nameId:'Sunset Glow',
      nameEn:'Sunset Glow',
      descId:'Gradasi hangat jingga-pink, ceria dan penuh energi.',
      descEn:'Warm orange-pink gradient, vibrant and energetic.',
      preview:'tp-sunset',
    },
    {
      id:    'neubrutalism',
      nameId:'Neubrutalism',
      nameEn:'Neubrutalism',
      descId:'Border tegas, shadow keras, tampilan modern berani.',
      descEn:'Bold borders, hard shadows, modern brutalist style.',
      preview:'tp-neubru',
    },
    {
      id:    'paper',
      nameId:'Paper',
      nameEn:'Paper',
      descId:'Tema kertas hangat, cocok untuk dokumen akademik.',
      descEn:'Warm paper theme, ideal for academic documents.',
      preview:'tp-paper',
    },
    {
      id:    'neumorphism',
      nameId:'Neumorphism',
      nameEn:'Neumorphism',
      descId:'Soft shadow lembut dengan efek kedalaman modern.',
      descEn:'Soft shadows with modern depth and highlights.',
      preview:'tp-neu',
    },
  ];

  /* ── State ── */
  let currentTheme = 'default';
  let isSwitching  = false; // guard: cegah transisi tumpang-tindih saat klik cepat

  /* ── Simpan & Load ── */
  function saveTheme(id) {
    try { localStorage.setItem(THEME_KEY, id); } catch (e) {}
  }
  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY) || 'default';
      // Guard: kalau value tersimpan ternyata bukan id tema yang valid
      // (mis. sisa versi lama / manipulasi manual), jatuhkan ke default.
      return THEMES.find(t => t.id === saved) ? saved : 'default';
    } catch (e) { return 'default'; }
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  /* ── Terapkan tema ke <html> (murni DOM, tanpa animasi) ── */
  function _applyDOM(id) {
    currentTheme = id;
    if (id === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', id);
    }
    _syncPanelUI();
    try {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: id } }));
    } catch (e) {}
  }

  /* ── Terapkan crossfade halus ──
     Catatan: sengaja TIDAK memakai View Transitions API — terbukti
     memicu bug rendering (ghosting/konten hilang) di beberapa
     browser/WebView mobile. Fade opacity manual di bawah ini jauh
     lebih stabil lintas perangkat & tetap terasa mulus. */
  function _applyWithFadeFallback(id) {
    document.body.classList.add('theme-transitioning');
    // Waktu fade-out singkat sebelum warna berganti, supaya terasa "crossfade"
    window.setTimeout(() => {
      _applyDOM(id);
      window.setTimeout(() => {
        document.body.classList.remove('theme-transitioning');
        isSwitching = false;
      }, 320);
    }, 90);
  }

  /* ── Terapkan tema (dipanggil saat init & set) ── */
  function applyTheme(id, animate) {
    if (!THEMES.find(t => t.id === id)) id = 'default';

    if (!animate) {
      _applyDOM(id);
      return;
    }

    // Guard: tema sama persis → tidak perlu transisi apa pun
    if (id === currentTheme) { _syncPanelUI(); return; }

    // Guard: transisi lain sedang berjalan → abaikan klik susulan
    // (mencegah flicker / data-theme berubah di tengah animasi)
    if (isSwitching) return;
    isSwitching = true;

    if (prefersReducedMotion()) {
      _applyDOM(id);
      isSwitching = false;
      return;
    }

    _applyWithFadeFallback(id);
  }

  /* ── Set tema (publik) ── */
  function setTheme(id) {
    if (!THEMES.find(t => t.id === id)) return; // guard: id tidak dikenal, abaikan
    applyTheme(id, true);
    saveTheme(id);
  }

  /* ── Sinkronkan UI panel tema ── */
  function _syncPanelUI() {
    document.querySelectorAll('.theme-card').forEach(card => {
      const active = card.dataset.themeId === currentTheme;
      card.classList.toggle('active', active);
      card.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    document.querySelectorAll('.nav-item[data-nav]').forEach(btn => {
      if (btn.dataset.nav === 'theme') {
        btn.classList.toggle('active', _currentNav() === 'theme');
      }
    });
  }

  function _currentNav() {
    return (typeof window.currentNav !== 'undefined') ? window.currentNav : '';
  }

  /* ── Render panel tema ── */
  function renderThemePanel() {
    const page = document.getElementById('pageTheme');
    if (!page) return;

    const lang = (typeof window.currentLang !== 'undefined') ? window.currentLang : 'id';

    const cards = THEMES.map(th => {
      const name = lang === 'en' ? th.nameEn : th.nameId;
      const desc = lang === 'en' ? th.descEn : th.descId;
      const isActive = th.id === currentTheme;

      const dots = `
        <div class="tp-dot" style="width:38px;height:8px;top:14px;left:14px;border-radius:4px;"></div>
        <div class="tp-dot" style="width:22px;height:8px;top:14px;left:60px;border-radius:4px;opacity:.6;"></div>
        <div class="tp-dot" style="width:60px;height:28px;top:30px;left:14px;border-radius:6px;opacity:.35;"></div>
        <div class="tp-dot" style="width:56px;height:28px;top:30px;left:82px;border-radius:6px;opacity:.35;"></div>
      `;

      return `
        <div
          class="theme-card${isActive ? ' active' : ''}"
          data-theme-id="${th.id}"
          role="radio"
          aria-checked="${isActive}"
          tabindex="0"
          title="${name}"
        >
          <div class="theme-card-preview ${th.preview}">
            ${dots}
          </div>
          <div class="theme-active-badge">
            <i class="fa-solid fa-check"></i> ${lang === 'en' ? 'Active' : 'Aktif'}
          </div>
          <div class="theme-card-name">${name}</div>
          <p class="theme-card-desc">${desc}</p>
        </div>
      `;
    }).join('');

    const title   = lang === 'en' ? 'Display Theme' : ' Tema Tampilan';
    const subtext = lang === 'en'
      ? 'Choose a theme. Your selection is saved automatically.'
      : 'Pilih tema tampilan website. Pilihan disimpan otomatis.';

    page.innerHTML = `
      <div class="theme-page-inner">
        <div class="theme-header">
          <h1>${title}</h1>
          <p>${subtext}</p>
        </div>
        <div class="theme-grid" role="radiogroup" aria-label="${title}">
          ${cards}
        </div>
      </div>
    `;

    page.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => setTheme(card.dataset.themeId));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setTheme(card.dataset.themeId);
        }
      });
    });
  }

  /* ── Init ── */
  function init() {
    const saved = loadTheme();
    applyTheme(saved, false);
  }

  /* ── Expose API global ── */
  window.ThemeSystem = {
    setTheme,
    applyTheme,
    renderThemePanel,
    getCurrentTheme: () => currentTheme,
    THEMES,
  };

  init();

})();
